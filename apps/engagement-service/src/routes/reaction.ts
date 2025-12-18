import { Router } from "express";
import { toggleReaction, getReaction } from "../controllers/reaction.js";

const router = Router();

// POST /videos/:id/reaction { type: "LIKE" | "DISLIKE" }
router.post("/videos/:id/reaction", toggleReaction);

// GET /videos/:id/reaction
router.get("/videos/:id/reaction", getReaction);

export default router;
