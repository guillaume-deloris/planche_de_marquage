import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import pool from "../db";
import "express-session";

const router = Router();

router.get("/login", (req: Request, res: Response) => {
    res.send("Page login - à venir");
});

router.post("/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;
    try {
        const { rows } = await pool.query("SELECT * FROM players WHERE username = $1", [username]);
        if (rows.length === 0) {
            res.status(401).send("Identifiants incorrects");
            return;
        }
        const player = rows[0];
        const valid = await bcrypt.compare(password, player.password);
        if (!valid) {
            res.status(401).send("Identifiants incorrects");
            return;
        }
        (req.session as any).player = {
            id: player.id,
            username: player.username,
            role: player.role,
        };
        res.redirect("/dashboard");
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

router.post("/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});

export default router;