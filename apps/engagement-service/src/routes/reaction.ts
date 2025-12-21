import { Router } from "express";
import { internalAuth } from "@repo/common";
import { requireActiveUser } from "../middleware/active.js";
import { toggleReaction, getReaction } from "../controllers/reaction.js";

const router = Router();

// POST /videos/:id/reaction { type: "LIKE" | "DISLIKE" }
router.post("/videos/:id/reaction", internalAuth(), requireActiveUser(), toggleReaction);

// GET /videos/:id/reaction (optional auth)
router.get("/videos/:id/reaction", internalAuth({ required: false }), getReaction);

export default router;
