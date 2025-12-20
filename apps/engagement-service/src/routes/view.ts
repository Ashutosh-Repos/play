import { Router } from "express";
import { internalAuth } from "@repo/common";
import { recordView } from "../controllers/view.js";

const router = Router();

// Views can be anonymous or authenticated (for personalization)
router.post("/videos/:id/view", internalAuth({ required: false }), recordView);

export default router;
