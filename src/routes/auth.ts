import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import pool from "../db";
import "express-session";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/login", (req: Request, res: Response) => {
    res.render("login", { title: "Connexion" });
});

router.post("/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;
    try {
        const { rows } = await pool.query("SELECT * FROM players WHERE username = $1", [username]);
        if (rows.length === 0) {
            res.render("login", { title: "Connexion", error: "Identifiants incorrects" });
            return;
        }
        const player = rows[0];
        const valid = await bcrypt.compare(password, player.password);
        if (!valid) {
            res.render("login", { title: "Connexion", error: "Identifiants incorrects" });
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

router.get("/dashboard", requireAuth, (req: Request, res: Response) => {
    res.render("dashboard", { title: "Dashboard", player: (req.session as any).player });
});

export default router;