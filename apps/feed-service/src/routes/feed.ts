import { Router } from "express";
import { getTrendingFeed, getSubscriptionFeed, getHistoryFeed, getHomeFeed } from "../controllers/feed.js";

const router = Router();

router.get("/home", getHomeFeed);
router.get("/trending", getTrendingFeed);
router.get("/subscriptions", getSubscriptionFeed);
router.get("/history", getHistoryFeed);

export default router;
