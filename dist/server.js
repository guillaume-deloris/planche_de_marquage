"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const express_handlebars_1 = require("express-handlebars");
const path_1 = __importDefault(require("path"));
const auth_1 = __importDefault(require("./routes/auth"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const games_1 = __importDefault(require("./routes/games"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.engine("hbs", (0, express_handlebars_1.engine)({
    extname: ".hbs",
    defaultLayout: "main",
    layoutsDir: path_1.default.join(__dirname, "views/layouts"),
    partialsDir: path_1.default.join(__dirname, "views/partials"),
    helpers: {
        eq: (a, b) => a === b,
        add: (a, b) => a + b,
        formatDate: (date) => new Date(date).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }),
    },
}));
app.set("view engine", "hbs");
app.set("views", path_1.default.join(__dirname, "views"));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.static(path_1.default.join(__dirname, "../public")));
app.use(express_session_1.default({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24,
    },
}));
app.get("/", (req, res) => {
    const player = req.session.player;
    if (player) {
        res.redirect("/dashboard");
    }
    else {
        res.render("home", { title: "Planche de marquage" });
    }
});
app.use("/", auth_1.default);
app.use("/", dashboard_1.default);
app.use("/", games_1.default);
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
