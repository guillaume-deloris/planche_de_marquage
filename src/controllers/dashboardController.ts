import { Request, Response } from "express";
import pool from "../db";

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
    const player = (req.session as any).player;
    try {
        const { rows: stats } = await pool.query(
            "SELECT win_count, game_count FROM players WHERE id = $1",
            [player.id]
        );
        const { rows: activeGames } = await pool.query(
            `SELECT g.id, g.name, g.status, g.created_at
            FROM games g
            JOIN game_scores gs ON gs.game_id = g.id
            WHERE gs.player_id = $1 AND g.status IN ('ready', 'in_progress')
            ORDER BY g.created_at DESC`,
            [player.id]
        );
        const { rows: finishedGames } = await pool.query(
            `SELECT g.id, g.name, g.status, g.created_at
            FROM games g
            JOIN game_scores gs ON gs.game_id = g.id
            WHERE gs.player_id = $1 AND g.status = 'finished'
            ORDER BY g.created_at DESC`,
            [player.id]
        );
        res.render("dashboard", {
            title: "Dashboard",
            player,
            stats: stats[0],
            activeGames,
            finishedGames,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
};