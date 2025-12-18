import { Router } from "express";
import { searchVideos } from "../controllers/search.js";

const router = Router();

router.get("/search", searchVideos);

export default router;
