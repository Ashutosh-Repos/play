// Settings routes
import { Router } from "express";
import { prisma } from "@repo/database";
import { authMiddleware } from "@repo/common";
import { updateNotificationSettingsSchema } from "../schemas.js";

const router = Router();

// GET /settings/notifications - Get notification settings
router.get("/notifications", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;

    let settings = await prisma.notificationSettings.findUnique({
      where: { userId },
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: { userId },
      });
    }

    res.json({
      success: true,
      data: {
        newVideos: settings.newVideos,
        liveStreams: settings.liveStreams,
        comments: settings.comments,
        replies: settings.replies,
        likes: settings.likes,
        subscribers: settings.subscribers,
        mentions: settings.mentions,
        emailEnabled: settings.emailEnabled,
        pushEnabled: settings.pushEnabled,
      },
    });
  } catch (error) {
    console.error("Get notification settings error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get settings" },
    });
  }
});

// PATCH /settings/notifications - Update notification settings
router.patch("/notifications", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;

    // Validate with Zod
    const parsed = updateNotificationSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const {
      newVideos,
      liveStreams,
      comments,
      replies,
      likes,
      subscribers,
      mentions,
      emailEnabled,
      pushEnabled,
    } = parsed.data;

    const settings = await prisma.notificationSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...(newVideos !== undefined && { newVideos }),
        ...(liveStreams !== undefined && { liveStreams }),
        ...(comments !== undefined && { comments }),
        ...(replies !== undefined && { replies }),
        ...(likes !== undefined && { likes }),
        ...(subscribers !== undefined && { subscribers }),
        ...(mentions !== undefined && { mentions }),
        ...(emailEnabled !== undefined && { emailEnabled }),
        ...(pushEnabled !== undefined && { pushEnabled }),
      },
      update: {
        ...(newVideos !== undefined && { newVideos }),
        ...(liveStreams !== undefined && { liveStreams }),
        ...(comments !== undefined && { comments }),
        ...(replies !== undefined && { replies }),
        ...(likes !== undefined && { likes }),
        ...(subscribers !== undefined && { subscribers }),
        ...(mentions !== undefined && { mentions }),
        ...(emailEnabled !== undefined && { emailEnabled }),
        ...(pushEnabled !== undefined && { pushEnabled }),
      },
    });

    res.json({
      success: true,
      data: {
        newVideos: settings.newVideos,
        liveStreams: settings.liveStreams,
        comments: settings.comments,
        replies: settings.replies,
        likes: settings.likes,
        subscribers: settings.subscribers,
        mentions: settings.mentions,
        emailEnabled: settings.emailEnabled,
        pushEnabled: settings.pushEnabled,
      },
    });
  } catch (error) {
    console.error("Update notification settings error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update settings" },
    });
  }
});

export default router;

