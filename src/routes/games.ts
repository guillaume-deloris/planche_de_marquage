import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { getNewGame, postNewGame, getGamePlayers, getGameByHash, getGameView, postScore, postFinishGame, getGameResults } from "../controllers/gameController";

const router = Router();

router.get("/games/new", requireAuth, getNewGame);
router.post("/games/new", requireAuth, postNewGame);
router.get("/games/:id/players", requireAuth, getGamePlayers);
router.get("/game/:hash", getGameByHash);
router.get("/games/:id/view", requireAuth, getGameView);
router.post("/games/:id/scores", requireAuth, postScore);
router.post("/games/:id/finish", requireAuth, postFinishGame);
router.get("/games/:id/results", requireAuth, getGameResults);

export default router;