import { Router } from "express";
import { recordView } from "../controllers/view.js";

const router = Router();

router.post("/videos/:id/view", recordView);

export default router;
