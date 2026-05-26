"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGamePlayersCount = exports.postGameOrder = exports.getGameResults = exports.postFinishGame = exports.postScore = exports.getGameView = exports.getGameByHash = exports.postNewGame = exports.getGamePlayers = exports.getNewGame = void 0;
const db_1 = __importDefault(require("../db"));
const qrcode_1 = __importDefault(require("qrcode"));
// displays game creation form with game types
const getNewGame = async (req, res) => {
    const player = req.session.player;
    try {
        const { rows: gameTypes } = await db_1.default.query("SELECT * FROM game_types WHERE creator_id = $1 ORDER BY name", [player.id]);
        res.render("games/new", {
            title: "Nouvelle partie",
            gameTypes,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
};
exports.getNewGame = getNewGame;
// displays players in creator game view with links
const getGamePlayers = async (req, res) => {
    const player = req.session.player;
    const gameId = req.params.id;
    try {
        const { rows: games } = await db_1.default.query("SELECT * FROM games WHERE id = $1 AND creator_id = $2", [gameId, player.id]);
        if (games.length === 0) {
            res.status(403).send("Accès refusé");
            return;
        }
        const { rows: players } = await db_1.default.query(`SELECT p.id, p.username, MIN(gs.play_order) as play_order FROM players p
            JOIN game_scores gs ON gs.game_id = $1 AND gs.player_id = p.id
            GROUP BY p.id, p.username
            ORDER BY play_order ASC`, [gameId]);
        const gameLink = `${req.protocol}://${req.get("host")}/game/${games[0].unique_link}`;
        const qrCode = await qrcode_1.default.toDataURL(gameLink);
        const { rows: scores } = await db_1.default.query(`SELECT gs.player_id, gs.round_number, gs.score, gs.status
            FROM game_scores gs
            WHERE gs.game_id = $1
            ORDER BY gs.player_id, gs.round_number`, [gameId]);
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
            const firstPendingRound = p.rounds.find((r) => r.status === "pending");
            if (firstPendingRound && firstPendingRound.round < minRound) {
                return firstPendingRound.round;
            }
            return minRound;
        }, Infinity);
        // find the next player to play - the first player statue pending in the current round
        const nextPlayer = currentRound === Infinity ? null : scoreMap.find(p => {
            const round = p.rounds.find((r) => r.round === currentRound);
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
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
};
exports.getGamePlayers = getGamePlayers;
// create game and game_scores entries for creator
const postNewGame = async (req, res) => {
    const player = req.session.player;
    const { name, gameTypeId, newGameTypeName, defaultRounds, roundCount } = req.body;
    try {
        // create new game type if selected
        let finalGameTypeId = gameTypeId;
        if (gameTypeId === "new") {
            const existing = await db_1.default.query("SELECT id FROM game_types WHERE name = $1 AND creator_id = $2", [newGameTypeName, player.id]);
            if (existing.rows.length > 0) {
                finalGameTypeId = existing.rows[0].id;
            }
            else {
                const result = await db_1.default.query("INSERT INTO game_types (name, default_rounds, creator_id) VALUES ($1, $2, $3) RETURNING id", [newGameTypeName, defaultRounds, player.id]);
                finalGameTypeId = result.rows[0].id;
            }
        }
        // create the game 
        const result = await db_1.default.query(`INSERT INTO games (name, creator_id, game_type_id, round_count, status) 
            VALUES ($1, $2, $3, $4, 'in_progress') RETURNING id`, [name, player.id, finalGameTypeId, roundCount]);
        const gameId = result.rows[0].id;
        // create game_scores entries
        const roundCountNum = Number(roundCount);
        for (let i = 1; i <= roundCountNum; i++) {
            await db_1.default.query("INSERT INTO game_scores (game_id, player_id, round_number, status, play_order) VALUES ($1, $2, $3, 'pending', 1)", [gameId, player.id, i]);
        }
        // game_count for player increment
        await db_1.default.query("UPDATE players SET game_count = game_count + 1 WHERE id = $1", [player.id]);
        res.redirect(`/games/${gameId}/players`);
    }
    catch (err) {
        console.error("erreur postNewGame:", err);
        res.status(500).send("Erreur serveur");
    }
};
exports.postNewGame = postNewGame;
// join game via unique link, create game_scores entries if not exist, redirect to game view
const getGameByHash = async (req, res) => {
    const { hash } = req.params;
    try {
        const { rows: games } = await db_1.default.query("SELECT * FROM games WHERE unique_link = $1", [hash]);
        if (games.length === 0) {
            res.status(404).send("Partie introuvable");
            return;
        }
        const player = req.session.player;
        if (!player) {
            req.session.redirectAfterLogin = `/game/${hash}`;
            res.redirect("/login");
            return;
        }
        const gameId = games[0].id;
        const { rows: existingPlayers } = await db_1.default.query("SELECT COUNT(DISTINCT player_id) as count FROM game_scores WHERE game_id = $1", [gameId]);
        const playOrder = Number(existingPlayers[0].count) + 1;
        // create game_scores entries for this player
        await db_1.default.query(`INSERT INTO game_scores (game_id, player_id, round_number, status, play_order)
            SELECT $1, $2, generate_series(1, $3), 'pending', $4
            WHERE NOT EXISTS (
                SELECT 1 FROM game_scores WHERE game_id = $1 AND player_id = $2
            )`, [gameId, player.id, games[0].round_count, playOrder]);
        // game_count for player increment
        await db_1.default.query("UPDATE players SET game_count = game_count + 1 WHERE id = $1", [player.id]);
        res.redirect(`/games/${gameId}/view`);
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
};
exports.getGameByHash = getGameByHash;
// displays players in no-creator view
const getGameView = async (req, res) => {
    const player = req.session.player;
    const gameId = req.params.id;
    try {
        const { rows: games } = await db_1.default.query("SELECT * FROM games WHERE id = $1", [gameId]);
        if (games.length === 0) {
            res.status(404).send("Partie introuvable");
            return;
        }
        const { rows: players } = await db_1.default.query(`SELECT p.id, p.username, MIN(gs.play_order) as play_order FROM players p
            JOIN game_scores gs ON gs.game_id = $1 AND gs.player_id = p.id
            GROUP BY p.id, p.username
            ORDER BY play_order ASC`, [gameId]);
        const { rows: scores } = await db_1.default.query(`SELECT gs.player_id, gs.round_number, gs.score, gs.status
            FROM game_scores gs
            WHERE gs.game_id = $1
            ORDER BY gs.player_id, gs.round_number`, [gameId]);
        const scoreMap = players.map(p => ({
            ...p,
            rounds: Array.from({ length: games[0].round_count }, (_, i) => {
                const s = scores.find(s => s.player_id === p.id && s.round_number === i + 1);
                return { round: i + 1, score: s?.score ?? null, status: s?.status ?? "pending" };
            }),
        }));
        const currentRound = scoreMap.reduce((minRound, p) => {
            const firstPendingRound = p.rounds.find((r) => r.status === "pending");
            if (firstPendingRound && firstPendingRound.round < minRound) {
                return firstPendingRound.round;
            }
            return minRound;
        }, Infinity);
        const nextPlayer = currentRound === Infinity ? null : scoreMap.find((p) => {
            const playerRound = p.rounds.find((round) => round.round === currentRound);
            return playerRound && playerRound.status === "pending";
        });
        const nextPlayerId = nextPlayer ? nextPlayer.id : null;
        const nextPlayerName = nextPlayer ? nextPlayer.username : null;
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
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
};
exports.getGameView = getGameView;
// update score for player and round
const postScore = async (req, res) => {
    const gameId = req.params.id;
    const { playerId, round, score } = req.body;
    try {
        await db_1.default.query(`UPDATE game_scores SET score = $1, status = 'played'
            WHERE game_id = $2 AND player_id = $3 AND round_number = $4`, [score, gameId, playerId, round]);
        res.json({ success: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};
exports.postScore = postScore;
// end game
const postFinishGame = async (req, res) => {
    const gameId = req.params.id;
    const player = req.session.player;
    try {
        const { rows: games } = await db_1.default.query("SELECT * FROM games WHERE id = $1 AND creator_id = $2", [gameId, player.id]);
        if (games.length === 0) {
            res.status(403).send("Accès refusé");
            return;
        }
        await db_1.default.query("UPDATE games SET status = 'finished' WHERE id = $1", [gameId]);
        // winner_count increment
        const { rows: winner } = await db_1.default.query(`SELECT player_id, SUM(score) as total
            FROM game_scores
            WHERE game_id = $1
            GROUP BY player_id
            ORDER BY total DESC
            LIMIT 1`, [gameId]);
        if (winner.length > 0) {
            await db_1.default.query("UPDATE players SET win_count = win_count + 1 WHERE id = $1", [winner[0].player_id]);
        }
        res.redirect(`/games/${gameId}/results`);
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
};
exports.postFinishGame = postFinishGame;
// displays game results with ranking
const getGameResults = async (req, res) => {
    const gameId = req.params.id;
    try {
        const { rows: games } = await db_1.default.query("SELECT * FROM games WHERE id = $1", [gameId]);
        if (games.length === 0) {
            res.status(404).send("Partie introuvable");
            return;
        }
        const { rows: players } = await db_1.default.query(`SELECT p.id, p.username FROM players p
            JOIN game_scores gs ON gs.game_id = $1 AND gs.player_id = p.id
            GROUP BY p.id, p.username`, [gameId]);
        const { rows: scores } = await db_1.default.query(`SELECT gs.player_id, gs.round_number, gs.score, gs.status
            FROM game_scores gs
            WHERE gs.game_id = $1
            ORDER BY gs.player_id, gs.round_number`, [gameId]);
        const ranking = players.map(p => ({
            ...p,
            total: scores
                .filter(s => s.player_id === p.id && s.score !== null)
                .reduce((sum, s) => sum + Number(s.score), 0),
            rounds: Array.from({ length: games[0].round_count }, (_, i) => {
                const s = scores.find(s => s.player_id === p.id && s.round_number === i + 1);
                return { round: i + 1, score: s?.score ?? null };
            }),
        })).sort((a, b) => b.total - a.total);
        res.render("games/results", {
            title: "Résultats",
            game: games[0],
            ranking,
            winner: ranking[0],
            roundCount: games[0].round_count,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
};
exports.getGameResults = getGameResults;
// update play order of players in creator game view
const postGameOrder = async (req, res) => {
    const gameId = req.params.id;
    const { order } = req.body;
    try {
        for (const item of order) {
            await db_1.default.query("UPDATE game_scores SET play_order = $1 WHERE game_id = $2 AND player_id = $3", [item.order, gameId, item.playerId]);
        }
        res.json({ success: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};
exports.postGameOrder = postGameOrder;
// polling update players
const getGamePlayersCount = async (req, res) => {
    const gameId = req.params.id;
    try {
        const { rows } = await db_1.default.query("SELECT COUNT(DISTINCT player_id) as count FROM game_scores WHERE game_id = $1", [gameId]);
        res.json({ count: Number(rows[0].count) });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ count: 0 });
    }
};
exports.getGamePlayersCount = getGamePlayersCount;
