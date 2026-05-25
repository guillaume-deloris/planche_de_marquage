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
        };
        const redirect = (req.session as any).redirectAfterLogin || "/dashboard";
        delete (req.session as any).redirectAfterLogin;
        req.session.save(() => {
            res.redirect(redirect);
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

router.post("/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

router.get("/register", (req: Request, res: Response) => {
    res.render("register", { title: "Créer un compte" });
});

router.post("/register", async (req: Request, res: Response) => {
    const { username, password, passwordConfirm } = req.body;
    if (password !== passwordConfirm) {
        res.render("register", { title: "Créer un compte", error: "Les mots de passe ne correspondent pas" });
        return;
    }
    const usernameRegex = /^[a-zA-Z0-9_-]{6,20}$/;
    if (!usernameRegex.test(username)) {
        res.render("register", { 
            title: "Créer un compte", 
            error: "Le pseudo doit contenir entre 6 et 20 caractères (lettres, chiffres, - et _ uniquement)" 
        });
        return;
    }
    try {
        const { rows } = await pool.query("SELECT id FROM players WHERE username = $1", [username]);
        if (rows.length > 0) {
            res.render("register", { title: "Créer un compte", error: "Ce pseudo est déjà pris" });
            return;
        }
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            "INSERT INTO players (username, password) VALUES ($1, $2) RETURNING id, username",
            [username, hash]
        );
        const player = result.rows[0];
        (req.session as any).player = {
            id: player.id,
            username: player.username,
        };
        const redirect = (req.session as any).redirectAfterLogin || "/dashboard";
        delete (req.session as any).redirectAfterLogin;
        req.session.save(() => {
            res.redirect(redirect);
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

export default router;