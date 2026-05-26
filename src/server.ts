import "dotenv/config";
import express from "express";
import expressSession from "express-session";
import { engine } from "express-handlebars";
import path from "path";
import authRouter from "./routes/auth";
import dashboardRouter from "./routes/dashboard";
import gamesRouter from "./routes/games";

const app = express();
const PORT = process.env.PORT || 3000;

app.engine("hbs", engine({
    extname: ".hbs",
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/partials"),
    helpers: {
        eq: (a: any, b: any) => a === b,
        add: (a: number, b: number) => a + b,
        formatDate: (date: Date) => new Date(date).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }),
    },
}));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

app.use((expressSession as any)({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24,
    },
}));

app.get("/", (req, res) => {
    const player = (req.session as any).player;
    if (player) {
        res.redirect("/dashboard");
    } else {
        res.render("home", { title: "Planche de marquage" });
    }
});

app.use("/", authRouter);
app.use("/", dashboardRouter);
app.use("/", gamesRouter);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});