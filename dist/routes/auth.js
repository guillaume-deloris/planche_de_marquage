"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_1 = __importDefault(require("../db"));
require("express-session");
const router = (0, express_1.Router)();
router.get("/login", (req, res) => {
    res.render("login", { title: "Connexion" });
});
router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const { rows } = await db_1.default.query("SELECT * FROM players WHERE username = $1", [username]);
        if (rows.length === 0) {
            res.render("login", { title: "Connexion", error: "Identifiants incorrects" });
            return;
        }
        const player = rows[0];
        const valid = await bcrypt_1.default.compare(password, player.password);
        if (!valid) {
            res.render("login", { title: "Connexion", error: "Identifiants incorrects" });
            return;
        }
        req.session.player = {
            id: player.id,
            username: player.username,
        };
        const redirect = req.session.redirectAfterLogin || "/dashboard";
        delete req.session.redirectAfterLogin;
        req.session.save(() => {
            res.redirect(redirect);
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});
router.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});
router.get("/register", (req, res) => {
    res.render("register", { title: "Créer un compte" });
});
router.post("/register", async (req, res) => {
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
        const { rows } = await db_1.default.query("SELECT id FROM players WHERE username = $1", [username]);
        if (rows.length > 0) {
            res.render("register", { title: "Créer un compte", error: "Ce pseudo est déjà pris" });
            return;
        }
        const hash = await bcrypt_1.default.hash(password, 10);
        const result = await db_1.default.query("INSERT INTO players (username, password) VALUES ($1, $2) RETURNING id, username", [username, hash]);
        const player = result.rows[0];
        req.session.player = {
            id: player.id,
            username: player.username,
        };
        const redirect = req.session.redirectAfterLogin || "/dashboard";
        delete req.session.redirectAfterLogin;
        req.session.save(() => {
            res.redirect(redirect);
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});
exports.default = router;
