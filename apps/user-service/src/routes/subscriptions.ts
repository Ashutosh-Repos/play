// Subscriptions routes
import { Router } from "express";
import { prisma } from "@repo/database";
import { authMiddleware } from "@repo/common";
import { updateSubscriptionSchema } from "../schemas.js";
import { emitSubscriptionCreated, emitSubscriptionDeleted } from "../events/publisher.js";

const router = Router();

// GET /subscriptions - My subscriptions
router.get("/", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const cursor = req.query.cursor as string | undefined;

    const subscriptions = await prisma.subscription.findMany({
      where: { subscriberId: userId },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { subscribedAt: "desc" },
      select: {
        id: true,
        notificationLevel: true,
        subscribedAt: true,
        channel: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
            subscriberCount: true,
          },
        },
      },
    });

    const hasMore = subscriptions.length > limit;
    const items = hasMore ? subscriptions.slice(0, -1) : subscriptions;

    res.json({
      success: true,
      data: {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : null,
      },
    });
  } catch (error) {
    console.error("Get subscriptions error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get subscriptions" },
    });
  }
});

// POST /subscriptions/:channelId - Subscribe
router.post("/:channelId", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { channelId } = req.params;

    // Get channel
    const channel = await prisma.channel.findUnique({
      where: { id: channelId, deletedAt: null },
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Channel not found" },
      });
    }

    // Prevent self-subscribe
    if (channel.userId === userId) {
      return res.status(400).json({
        success: false,
        error: { code: "SELF_SUBSCRIBE", message: "Cannot subscribe to your own channel" },
      });
    }

    // Check existing
    const existing = await prisma.subscription.findUnique({
      where: { subscriberId_channelId: { subscriberId: userId, channelId: channelId! } },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: { code: "ALREADY_SUBSCRIBED", message: "Already subscribed" },
      });
    }

    // Create subscription and increment counter atomically
    const [subscription] = await prisma.$transaction([
      prisma.subscription.create({
        data: { subscriberId: userId, channelId: channelId! },
        select: {
          id: true,
          notificationLevel: true,
          subscribedAt: true,
        },
      }),
      prisma.channel.update({
        where: { id: channelId },
        data: { subscriberCount: { increment: 1 } },
      }),
    ]);

    // Emit event
    emitSubscriptionCreated(userId, channelId!);

    res.status(201).json({ success: true, data: subscription });
  } catch (error) {
    console.error("Subscribe error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to subscribe" },
    });
  }
});

// GET /subscriptions/:channelId/status - Check subscription status (MUST be before /:channelId DELETE/PATCH)
router.get("/:channelId/status", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { channelId } = req.params;

    const subscription = await prisma.subscription.findUnique({
      where: { subscriberId_channelId: { subscriberId: userId, channelId: channelId! } },
      select: {
        id: true,
        notificationLevel: true,
        subscribedAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        subscribed: !!subscription,
        subscription,
      },
    });
  } catch (error) {
    console.error("Check subscription error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to check subscription" },
    });
  }
});

// DELETE /subscriptions/:channelId - Unsubscribe
router.delete("/:channelId", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { channelId } = req.params;

    const subscription = await prisma.subscription.findUnique({
      where: { subscriberId_channelId: { subscriberId: userId, channelId: channelId! } },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Subscription not found" },
      });
    }

    // Delete and decrement atomically (safe decrement - won't go below 0)
    await prisma.$transaction([
      prisma.subscription.delete({ where: { id: subscription.id } }),
      prisma.$executeRaw`UPDATE channels SET subscriber_count = GREATEST(subscriber_count - 1, 0) WHERE id = ${channelId}`,
    ]);

    // Emit event
    emitSubscriptionDeleted(userId, channelId!);

    res.json({ success: true, data: { message: "Unsubscribed" } });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to unsubscribe" },
    });
  }
});

// PATCH /subscriptions/:channelId - Update notification level
router.patch("/:channelId", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { channelId } = req.params;

    // Validate with Zod
    const parsed = updateSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid notification level" },
      });
    }

    const { notificationLevel } = parsed.data;

    const subscription = await prisma.subscription.update({
      where: { subscriberId_channelId: { subscriberId: userId, channelId: channelId! } },
      data: { notificationLevel },
      select: {
        id: true,
        notificationLevel: true,
      },
    });

    res.json({ success: true, data: subscription });
  } catch (error) {
    console.error("Update subscription error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update subscription" },
    });
  }
});

export default router;

