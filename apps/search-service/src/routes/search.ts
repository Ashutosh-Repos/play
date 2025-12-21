import { Router } from "express";
import { searchVideos } from "../controllers/search.js";

const router = Router();

import rateLimit from "express-rate-limit";

// Rate Limit: 50 requests per 1 minute
const searchLimiter = rateLimit({
	windowMs: 1 * 60 * 1000,
	limit: 50,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: "Too many search requests, please try again later." }
});

router.get("/search", searchLimiter, searchVideos);

export default router;
