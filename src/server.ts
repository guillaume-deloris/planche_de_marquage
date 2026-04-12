import "dotenv/config";
import express from "express";
import session = require("express-session");
import authRouter from "./routes/auth";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24,
    },
}));

app.use("/", authRouter);

app.get("/", (req, res) => {
    res.send("Planche de marquage - OK");
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});