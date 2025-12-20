// Channels routes
import { Router } from "express";
import { prisma } from "@repo/database";
import { authMiddleware, requireRole } from "@repo/common";
import { createChannelSchema, updateChannelSchema } from "@repo/validation";
import { emitChannelCreated, emitChannelUpdated, emitChannelDeleted } from "../events/publisher.js";
import { getCachedChannel, cacheChannel, invalidateChannelCache } from "../lib/redis.js";

const router = Router();

// POST /channels - Create channel
router.post("/", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;

    // Validate with Zod
    const parsed = createChannelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { handle, displayName, description } = parsed.data;

    // Check if user already has channel
    const existingChannel = await prisma.channel.findUnique({ where: { userId } });
    if (existingChannel) {
      return res.status(400).json({
        success: false,
        error: { code: "CHANNEL_EXISTS", message: "You already have a channel" },
      });
    }

    // Check handle availability
    const handleTaken = await prisma.channel.findUnique({ where: { handle: handle.toLowerCase() } });
    if (handleTaken) {
      return res.status(400).json({
        success: false,
        error: { code: "HANDLE_TAKEN", message: "This handle is already taken" },
      });
    }

    const channel = await prisma.channel.create({
      data: {
        userId,
        handle: handle.toLowerCase(),
        displayName: displayName || handle,
        description,
      },
      select: {
        id: true,
        handle: true,
        displayName: true,
        description: true,
        avatarUrl: true,
        bannerUrl: true,
        isVerified: true,
        createdAt: true,
      },
    });

    // Emit event
    emitChannelCreated(channel.id, userId, channel.handle);

    res.status(201).json({ success: true, data: channel });
  } catch (error) {
    console.error("Create channel error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to create channel" },
    });
  }
});

// GET /channels/me - Get my channel (MUST be before /:handle)
router.get("/me", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;

    const channel = await prisma.channel.findUnique({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        handle: true,
        displayName: true,
        description: true,
        avatarUrl: true,
        bannerUrl: true,
        isVerified: true,
        links: true,
        location: true,
        contactEmail: true,
        subscriberCount: true,
        videoCount: true,
        totalViews: true,
        createdAt: true,
      },
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: { code: "NO_CHANNEL", message: "You don't have a channel yet" },
      });
    }

    res.json({ success: true, data: channel });
  } catch (error) {
    console.error("Get my channel error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get channel" },
    });
  }
});

// GET /channels/:handle - Get channel (with Redis caching)
router.get("/:handle", async (req, res) => {
  try {
    const { handle } = req.params;
    if (!handle) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Handle is required" },
      });
    }

    // Check cache first
    const cached = await getCachedChannel(handle);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    // Cache miss - fetch from DB
    const channel = await prisma.channel.findUnique({
      where: { handle: handle.toLowerCase(), deletedAt: null },
      select: {
        id: true,
        handle: true,
        displayName: true,
        description: true,
        avatarUrl: true,
        bannerUrl: true,
        isVerified: true,
        links: true,
        location: true,
        contactEmail: true,
        subscriberCount: true,
        videoCount: true,
        totalViews: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Channel not found" },
      });
    }

    // Cache the result
    await cacheChannel(handle, channel);

    res.json({ success: true, data: channel });
  } catch (error) {
    console.error("Get channel error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get channel" },
    });
  }
});

// PATCH /channels/:handle - Update channel (owner only)
router.patch("/:handle", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { handle } = req.params;

    // Validate with Zod
    const parsed = updateChannelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { displayName, description, avatarUrl, bannerUrl, links, location, contactEmail } = parsed.data;

    // Find channel and verify ownership
    const channel = await prisma.channel.findUnique({
      where: { handle: handle!.toLowerCase() },
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Channel not found" },
      });
    }

    if (channel.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You can only update your own channel" },
      });
    }

    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(description !== undefined && { description }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(bannerUrl !== undefined && { bannerUrl }),
        ...(links !== undefined && { links }),
        ...(location !== undefined && { location }),
        ...(contactEmail !== undefined && { contactEmail }),
      },
      select: {
        id: true,
        handle: true,
        displayName: true,
        description: true,
        avatarUrl: true,
        bannerUrl: true,
        links: true,
        location: true,
        contactEmail: true,
        isVerified: true,
      },
    });

    // Emit event with only changed fields
    const changes: Record<string, unknown> = {};
    if (displayName !== undefined) changes.displayName = displayName;
    if (description !== undefined) changes.description = description;
    if (avatarUrl !== undefined) changes.avatarUrl = avatarUrl;
    if (bannerUrl !== undefined) changes.bannerUrl = bannerUrl;
    if (links !== undefined) changes.links = links;
    if (location !== undefined) changes.location = location;
    if (contactEmail !== undefined) changes.contactEmail = contactEmail;
    emitChannelUpdated(channel.id, changes);

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update channel error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update channel" },
    });
  }
});

// GET /channels/:handle/subscribers - Get channel subscribers (owner only)
router.get("/:handle/subscribers", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { handle } = req.params;
    if (!handle) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Handle is required" },
      });
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const cursor = req.query.cursor as string | undefined;

    // Verify ownership
    const channel = await prisma.channel.findUnique({
      where: { handle: handle.toLowerCase(), deletedAt: null },
      select: { id: true, userId: true },
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Channel not found" },
      });
    }

    if (channel.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You can only view your own subscribers" },
      });
    }

    const subscribers = await prisma.subscription.findMany({
      where: { channelId: channel.id },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { subscribedAt: "desc" },
      select: {
        id: true,
        subscribedAt: true,
        notificationLevel: true,
        subscriber: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const hasMore = subscribers.length > limit;
    const items = hasMore ? subscribers.slice(0, -1) : subscribers;

    res.json({
      success: true,
      data: {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : null,
      },
    });
  } catch (error) {
    console.error("Get subscribers error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get subscribers" },
    });
  }
});

// DELETE /channels/:handle - Delete channel (owner only)
router.delete("/:handle", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { handle } = req.params;
    if (!handle) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Handle is required" },
      });
    }

    const channel = await prisma.channel.findUnique({
      where: { handle: handle.toLowerCase() },
      select: { id: true, userId: true },
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Channel not found" },
      });
    }

    if (channel.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You can only delete your own channel" },
      });
    }

    // Soft delete (videos will be handled by video-service via event)
    await prisma.channel.update({
      where: { id: channel.id },
      data: { deletedAt: new Date() },
    });

    // Emit channel.deleted event for video-service to handle video cleanup
    emitChannelDeleted(channel.id, userId);

    res.json({
      success: true,
      data: { message: "Channel deleted. Videos will be removed shortly." },
    });
  } catch (error) {
    console.error("Delete channel error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to delete channel" },
    });
  }
});

export default router;
