import { Request, Response } from "express";
import pool from "../db";

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
            VALUES ($1, $2, $3, $4, 'draft') RETURNING id`,
            [name, player.id, finalGameTypeId, roundCount]
        );

        const gameId = result.rows[0].id;
        res.redirect(`/games/${gameId}/players`);
    } catch (err) {
        
          console.error("erreur postNewGame:", err);
        res.status(500).send("Erreur serveur");
    }
};