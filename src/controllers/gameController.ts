import { Request, Response } from "express";
import pool from "../db";
import QRCode from "qrcode";

// displays game creation form with game types
export const getNewGame = async (req: Request, res: Response): Promise<void> => {
    const player = (req.session as any).player;
    try {
        const { rows: gameTypes } = await pool.query(
            "SELECT * FROM game_types WHERE creator_id = $1 ORDER BY name",
            [player.id]
        );
        res.render("games/new", {
            title: "Nouvelle partie",
            gameTypes,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
};

// displays players in creator game view with links
export const getGamePlayers = async (req: Request, res: Response): Promise<void> => {
    const player = (req.session as any).player;
    const gameId = req.params.id;
    try {
        const { rows: games } = await pool.query(
            "SELECT * FROM games WHERE id = $1 AND creator_id = $2",
            [gameId, player.id]
        );
        if (games.length === 0) {
            res.status(403).send("Accès refusé");
            return;
        }
        const { rows: players } = await pool.query(
            `SELECT p.id, p.username, MIN(gs.play_order) as play_order FROM players p
            JOIN game_scores gs ON gs.game_id = $1 AND gs.player_id = p.id
            GROUP BY p.id, p.username
            ORDER BY play_order ASC`,
            [gameId]
        );

        const gameLink = `${req.protocol}://${req.get("host")}/game/${games[0].unique_link}`;
        const qrCode = await QRCode.toDataURL(gameLink);
        const { rows: scores } = await pool.query(
            `SELECT gs.player_id, gs.round_number, gs.score, gs.status
            FROM game_scores gs
            WHERE gs.game_id = $1
            ORDER BY gs.player_id, gs.round_number`,
            [gameId]
        );
        const scoreMap = players.map(p => ({
            ...p,
            rounds: Array.from({ length: games[0].round_count }, (_, i) => {
                const s = scores.find(s => s.player_id === p.id && s.round_number === i + 1);
                return { round: i + 1, score: s?.score ?? null, status: s?.status ?? "pending" };
            }),
            total: scores
                .filter(s => s.player_id === p.id && s.score !== null)
                .reduce((sum, s) => sum + Number(s.score), 0),
        }));

        // find the current round - the next pending round
        const currentRound = scoreMap.reduce((minRound, p) => {
            const firstPendingRound = p.rounds.find((r: any) => r.status === "pending");
            if (firstPendingRound && firstPendingRound.round < minRound) {
                return firstPendingRound.round;
            }
            return minRound;
        }, Infinity);

        // find the next player to play - the first player statue pending in the current round
        const nextPlayer = currentRound === Infinity ? null : scoreMap.find(p => {
            const round = p.rounds.find((r: any) => r.round === currentRound);
            return round && round.status === "pending";
        });

        const nextPlayerId = nextPlayer ? nextPlayer.id : null;
        const nextPlayerName = nextPlayer ? nextPlayer.username : null;
        const currentRoundDisplay = currentRound === Infinity ? null : currentRound;

        res.render("games/players", {
            title: "Joueurs de la partie",
            game: games[0],
            players,
            scoreMap,
            roundCount: games[0].round_count,
            qrCode,
            gameLink,
            nextPlayerId,
            nextPlayerName,
            currentRoundDisplay
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
};

// create game and game_scores entries for creator
export const postNewGame = async (req: Request, res: Response): Promise<void> => {
    const player = (req.session as any).player;
    const { name, gameTypeId, newGameTypeName, defaultRounds, roundCount } = req.body;
    try {
        let finalGameTypeId = gameTypeId;
        if (gameTypeId === "new") {
            const result = await pool.query(
                "INSERT INTO game_types (name, default_rounds, creator_id) VALUES ($1, $2, $3) RETURNING id",
                [newGameTypeName, defaultRounds, player.id]
            );
            finalGameTypeId = result.rows[0].id;
        }

        const result = await pool.query(
            `INSERT INTO games (name, creator_id, game_type_id, round_count, status) 
            VALUES ($1, $2, $3, $4, 'in_progress') RETURNING id`,
            [name, player.id, finalGameTypeId, roundCount]
        );

        const gameId = result.rows[0].id;
        const roundCountNum = Number(roundCount);
        for (let i = 1; i <= roundCountNum; i++) {
            await pool.query(
                "INSERT INTO game_scores (game_id, player_id, round_number, status, play_order) VALUES ($1, $2, $3, 'pending', 1)",
                [gameId, player.id, i]
            );
        }
        res.redirect(`/games/${gameId}/players`);
    } catch (err) {
        console.error("erreur postNewGame:", err);
        res.status(500).send("Erreur serveur");
    }
};

// join game via unique link, create game_scores entries if not exist, redirect to game view
export const getGameByHash = async (req: Request, res: Response): Promise<void> => {
    const { hash } = req.params;
    try {
        const { rows: games } = await pool.query(
            "SELECT * FROM games WHERE unique_link = $1",
            [hash]
        );
        if (games.length === 0) {
            res.status(404).send("Partie introuvable");
            return;
        }
        const player = (req.session as any).player;
        if (!player) {
            (req.session as any).redirectAfterLogin = `/game/${hash}`;
            res.redirect("/login");
            return;
        }
        const gameId = games[0].id;
        const { rows: existingPlayers } = await pool.query(
            "SELECT COUNT(DISTINCT player_id) as count FROM game_scores WHERE game_id = $1",
            [gameId]
        );
        const playOrder = Number(existingPlayers[0].count) + 1;

        await pool.query(
            `INSERT INTO game_scores (game_id, player_id, round_number, status, play_order)
            SELECT $1, $2, generate_series(1, $3), 'pending', $4
            WHERE NOT EXISTS (
                SELECT 1 FROM game_scores WHERE game_id = $1 AND player_id = $2
            )`,
            [gameId, player.id, games[0].round_count, playOrder]
        );
        res.redirect(`/games/${gameId}/view`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
};

// displays players in no-creator view
export const getGameView = async (req: Request, res: Response): Promise<void> => {
    const player = (req.session as any).player;
    const gameId = req.params.id;
    try {
        const { rows: games } = await pool.query(
            "SELECT * FROM games WHERE id = $1",
            [gameId]
        );
        if (games.length === 0) {
            res.status(404).send("Partie introuvable");
            return;
        }
        const { rows: players } = await pool.query(
            `SELECT p.id, p.username, MIN(gs.play_order) as play_order FROM players p
            JOIN game_scores gs ON gs.game_id = $1 AND gs.player_id = p.id
            GROUP BY p.id, p.username
            ORDER BY play_order ASC`,
            [gameId]
        );
        const { rows: scores } = await pool.query(
            `SELECT gs.player_id, gs.round_number, gs.score, gs.status
            FROM game_scores gs
            WHERE gs.game_id = $1
            ORDER BY gs.player_id, gs.round_number`,
            [gameId]
        );
        const scoreMap = players.map(p => ({
            ...p,
            rounds: Array.from({ length: games[0].round_count }, (_, i) => {
                const s = scores.find(s => s.player_id === p.id && s.round_number === i + 1);
                return { round: i + 1, score: s?.score ?? null, status: s?.status ?? "pending" };
            }),
        }));
        const currentRound = scoreMap.reduce((minRound: number, p: any) => {
        const firstPendingRound = p.rounds.find((r: any) => r.status === "pending");
        if (firstPendingRound && firstPendingRound.round < minRound) {
            return firstPendingRound.round;
        }
        return minRound;
    }, Infinity);
        const nextPlayer = currentRound === Infinity ? null : scoreMap.find((p: any) => {
            const playerRound = p.rounds.find((round: any) => round.round === currentRound);
            return playerRound && playerRound.status === "pending";
        });

        const nextPlayerId = nextPlayer ? (nextPlayer as any).id : null;
        const nextPlayerName = nextPlayer ? (nextPlayer as any).username : null;
        const currentRoundDisplay = currentRound === Infinity ? null : currentRound;

        res.render("games/view", {
            title: games[0].name,
            game: games[0],
            scoreMap,
            roundCount: games[0].round_count,
            isCreator: player.id === games[0].creator_id,
            nextPlayerId,
            nextPlayerName,
            currentRoundDisplay,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
};

// update score for player and round
export const postScore = async (req: Request, res: Response): Promise<void> => {
    const gameId = req.params.id;
    const { playerId, round, score } = req.body;

    try {
        await pool.query(
            `UPDATE game_scores SET score = $1, status = 'played'
            WHERE game_id = $2 AND player_id = $3 AND round_number = $4`,
            [score, gameId, playerId, round]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};

// end game
export const postFinishGame = async (req: Request, res: Response): Promise<void> => {
    const gameId = req.params.id;
    const player = (req.session as any).player;
    try {
        const { rows: games } = await pool.query(
            "SELECT * FROM games WHERE id = $1 AND creator_id = $2",
            [gameId, player.id]
        );
        if (games.length === 0) {
            res.status(403).send("Accès refusé");
            return;
        }
        await pool.query(
            "UPDATE games SET status = 'finished' WHERE id = $1",
            [gameId]
        );
        res.redirect(`/games/${gameId}/results`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
};

// displays game results with ranking
export const getGameResults = async (req: Request, res: Response): Promise<void> => {
    const gameId = req.params.id;
    try {
        const { rows: games } = await pool.query(
            "SELECT * FROM games WHERE id = $1",
            [gameId]
        );
        if (games.length === 0) {
            res.status(404).send("Partie introuvable");
            return;
        }
        const { rows: players } = await pool.query(
            `SELECT p.id, p.username FROM players p
            JOIN game_scores gs ON gs.game_id = $1 AND gs.player_id = p.id
            GROUP BY p.id, p.username`,
            [gameId]
        );
        const { rows: scores } = await pool.query(
            `SELECT gs.player_id, gs.round_number, gs.score
            FROM game_scores gs
            WHERE gs.game_id = $1
            ORDER BY gs.player_id, gs.round_number`,
            [gameId]
        );
        const ranking = players.map(p => ({
            ...p,
            total: scores
                .filter(s => s.player_id === p.id && s.score !== null)
                .reduce((sum, s) => sum + Number(s.score), 0),
        })).sort((a, b) => b.total - a.total);
        res.render("games/results", {
            title: "Résultats",
            game: games[0],
            ranking,
            winner: ranking[0],
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
};

// update play order of players in creator game view
export const postGameOrder = async (req: Request, res: Response): Promise<void> => {
    const gameId = req.params.id;
    const { order } = req.body;
    try {
        for (const item of order) {
            await pool.query(
                "UPDATE game_scores SET play_order = $1 WHERE game_id = $2 AND player_id = $3",
                [item.order, gameId, item.playerId]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};

// polling update players
export const getGamePlayersCount = async (req: Request, res: Response): Promise<void> => {
    const gameId = req.params.id;
    try {
        const { rows } = await pool.query(
            "SELECT COUNT(DISTINCT player_id) as count FROM game_scores WHERE game_id = $1",
            [gameId]
        );
        res.json({ count: Number(rows[0].count) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ count: 0 });
    }
};