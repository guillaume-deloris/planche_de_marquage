import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.send("Planche de marquage - OK");
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});