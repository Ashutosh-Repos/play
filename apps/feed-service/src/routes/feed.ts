import { Router } from "express";
import { internalAuth } from "@repo/common";
import { getTrendingFeed, getSubscriptionFeed, getHistoryFeed, getHomeFeed } from "../controllers/feed.js";

const router = Router();

router.get("/home", getHomeFeed);
router.get("/trending", getTrendingFeed);
router.get("/subscriptions", internalAuth(), getSubscriptionFeed);
router.get("/history", internalAuth(), getHistoryFeed);

export default router;
