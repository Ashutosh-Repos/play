import { Router } from "express";
import { internalAuth } from "@repo/common";
import { getNotifications, markAsRead, markAllAsRead } from "../controllers/notification.js";

const router = Router();

router.get("/", internalAuth(), getNotifications);
router.patch("/:id/read", internalAuth(), markAsRead);
router.patch("/read-all", internalAuth(), markAllAsRead);

export default router;
