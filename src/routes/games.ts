import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { getNewGame, postNewGame } from "../controllers/gameController";

const router = Router();

router.get("/games/new", requireAuth, getNewGame);
router.post("/games/new", requireAuth, postNewGame);

export default router;