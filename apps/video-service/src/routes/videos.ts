// Video routes - CRUD, publishing, status
import { Router } from "express";
import { prisma } from "@repo/database";
import { authMiddleware } from "@repo/common";
import {
  createVideoSchema,
  updateVideoSchema,
  publishVideoSchema,
  videoListQuerySchema,
} from "../schemas.js";
import {
  emitVideoPublished,
  emitVideoDeleted,
  emitVideoUpdated,
  processOutboxItem,
} from "../events/publisher.js";
import { getFileUrl } from "../lib/storage.js";

const router = Router();

// GET /videos - Public video feed
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const cursor = req.query.cursor as string | undefined;
    const sort = (req.query.sort as string) || "latest"; // latest, popular

    const orderBy = 
      sort === "popular" 
        ? [{ viewCount: "desc" as const }, { id: "desc" as const }]
        : [{ createdAt: "desc" as const }, { id: "desc" as const }];

    const videos = await prisma.video.findMany({
      where: {
        visibility: "PUBLIC",
        processingStatus: "READY",
        deletedAt: null,
      },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy,
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        duration: true,
        viewCount: true,
        publishedAt: true,
        createdAt: true,
        channelName: true,
        channelHandle: true,
        channelAvatarUrl: true,
        channel: {
            select: {
                id: true,
                handle: true,
                displayName: true,
                avatarUrl: true
            }
        }
      },
    });

    const hasMore = videos.length > limit;
    const rawItems = hasMore ? videos.slice(0, -1) : videos;

    const items = rawItems.map(v => ({
      ...v,
      thumbnailUrl: getFileUrl(v.thumbnailUrl),
      channelAvatarUrl: getFileUrl(v.channelAvatarUrl || v.channel.avatarUrl)
    }));

    res.json({
      success: true,
      data: {
        items,
        nextCursor: hasMore ? rawItems[rawItems.length - 1]?.id : null,
      },
    });
  } catch (error) {
    console.error("Get public feed error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get feed" },
    });
  }
});

// POST /videos - Create video draft
router.post("/", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;

    // Validate with Zod
    const parsed = createVideoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { title, description, categoryId, tags, language, visibility } = parsed.data;

    // Get user's channel
    const channel = await prisma.channel.findUnique({
      where: { userId },
      select: { id: true, handle: true, displayName: true, avatarUrl: true },
    });

    if (!channel) {
      return res.status(400).json({
        success: false,
        error: { code: "NO_CHANNEL", message: "You need a channel to upload videos" },
      });
    }

    // Validate category exists if provided
    if (categoryId) {
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_CATEGORY", message: "Category not found" },
        });
      }
    }

    const video = await prisma.video.create({
      data: {
        channelId: channel.id,
        title,
        description,
        categoryId,
        tags: tags || [],
        language,
        visibility,
        // Denormalized channel info for feed queries
        channelHandle: channel.handle,
        channelName: channel.displayName,
        channelAvatarUrl: channel.avatarUrl,
        processingStatus: "PENDING",
      },
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        processingStatus: true,
        createdAt: true,
      },
    });

    // Emit event
    // emitVideoCreated(video.id, channel.id, video.title);

    res.status(201).json({ success: true, data: video });
  } catch (error) {
    console.error("Create video error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to create video" },
    });
  }
});

// GET /videos/me - My videos (creator dashboard)
router.get("/me", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const cursor = req.query.cursor as string | undefined;
    const status = req.query.status as string | undefined;

    // Get user's channel
    const channel = await prisma.channel.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!channel) {
      return res.json({ success: true, data: { items: [], nextCursor: null } });
    }

    const videos = await prisma.video.findMany({
      where: {
        channelId: channel.id,
        deletedAt: null,
        ...(status && ["PENDING", "PROCESSING", "READY", "FAILED"].includes(status) 
           ? { processingStatus: status as "PENDING" | "PROCESSING" | "READY" | "FAILED" } 
           : {}),
      },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        visibility: true,
        processingStatus: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        duration: true,
        publishedAt: true,
        createdAt: true,
      },
    });

    const hasMore = videos.length > limit;
    const rawItems = hasMore ? videos.slice(0, -1) : videos;
    
    // Transform items
    const items = rawItems.map(v => ({
      ...v,
      thumbnailUrl: getFileUrl(v.thumbnailUrl)
    }));

    res.json({
      success: true,
      data: {
        items,
        nextCursor: hasMore ? rawItems[rawItems.length - 1]?.id : null,
      },
    });
  } catch (error) {
    console.error("Get my videos error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get videos" },
    });
  }
});

// GET /videos/:id/status - Processing status (for polling)
router.get("/:id/status", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;

    const video = await prisma.video.findUnique({
      where: { id },
      select: {
        id: true,
        processingStatus: true,
        processingError: true,
        processingProgress: true,
        thumbnailOptions: true,
        channel: { select: { userId: true } },
      },
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found" },
      });
    }

    // Verify ownership
    if (video.channel.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not your video" },
      });
    }

    const canPublish = video.processingStatus === "READY";

    res.json({
      success: true,
      data: {
        id: video.id,
        status: video.processingStatus,
        progress: video.processingProgress,
        error: video.processingError,
        thumbnailOptions: video.thumbnailOptions.map(t => getFileUrl(t)),
        canPublish,
      },
    });
  } catch (error) {
    console.error("Get video status error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get status" },
    });
  }
});

// GET /videos/:id - Get video (public)
router.get("/:id", authMiddleware({ required: false }), async (req, res) => {
  try {
    const { id } = req.params;

    const video = await prisma.video.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        visibility: true,
        processingStatus: true,
        hlsPlaylistUrl: true,
        thumbnailUrl: true,
        duration: true,
        width: true,
        height: true,
        viewCount: true,
        likeCount: true,
        dislikeCount: true,
        commentCount: true,
        allowComments: true,
        allowEmbedding: true,
        isAgeRestricted: true,
        previewSprite: true,
        publishedAt: true,
        createdAt: true,
        channelHandle: true,
        channelName: true,
        channelAvatarUrl: true,
        channel: {
          select: {
            id: true,
            userId: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
            subscriberCount: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found" },
      });
    }

    // Check visibility
    // SCHEDULED videos should be treated as PRIVATE until they are published (handled by scheduler or if checks publishedAt)
    // Actually, SCHEDULED status exists in enum.
    if (video.visibility === "PRIVATE" || video.visibility === "SCHEDULED" || video.visibility === "UNLISTED") {
      // Check ownership if user is logged in
      const userId = req.user?.sub;
      const isOwner = userId && video.channel.userId === userId;

      if (!isOwner) {
         // PRIVATE and SCHEDULED are owner-only
         if (video.visibility === "PRIVATE" || video.visibility === "SCHEDULED") {
             return res.status(404).json({
                success: false,
                error: { code: "NOT_FOUND", message: "Video not found" },
             });
         }
         // Unlisted is accessible to anyone with the link/ID, so fall through
      }
    }

    // Transform keys to URLs
    const videoWithUrls = {
      ...video,
      hlsPlaylistUrl: getFileUrl(video.hlsPlaylistUrl),
      thumbnailUrl: getFileUrl(video.thumbnailUrl),
      previewSprite: getFileUrl(video.previewSprite),
      channel: {
        ...video.channel,
        avatarUrl: getFileUrl(video.channel.avatarUrl),
      }
    };

    res.json({ success: true, data: videoWithUrls });
  } catch (error) {
    console.error("Get video error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get video" },
    });
  }
});

// PATCH /videos/:id - Update video
router.patch("/:id", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;

    // Validate with Zod
    const parsed = updateVideoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    // Verify ownership
    const video = await prisma.video.findUnique({
      where: { id },
      select: { channel: { select: { userId: true } } },
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found" },
      });
    }

    if (video.channel.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not your video" },
      });
    }

    const updated = await prisma.video.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        thumbnailUrl: true,
        allowComments: true,
        allowEmbedding: true,
        isAgeRestricted: true,
        channelId: true,
      },
    });

    // Emit update event for search re-indexing
    const changedFields = Object.keys(parsed.data);
    emitVideoUpdated(updated.id, updated.channelId, changedFields);

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update video error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update video" },
    });
  }
});

// POST /videos/:id/publish - Publish video
router.post("/:id/publish", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;

    // Validate with Zod
    const parsed = publishVideoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { visibility, scheduledAt } = parsed.data;

    // Validate scheduledAt required for SCHEDULED visibility
    if (visibility === "SCHEDULED" && !scheduledAt) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_SCHEDULED_AT", message: "scheduledAt is required for scheduled videos" },
      });
    }

    // Verify ownership and status
    const video = await prisma.video.findUnique({
      where: { id },
      select: {
        processingStatus: true,
        channelId: true,
        title: true,
        thumbnailUrl: true,
        duration: true,
        channel: { select: { userId: true } },
      },
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found" },
      });
    }

    if (video.channel.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not your video" },
      });
    }

    if (video.processingStatus !== "READY") {
      return res.status(400).json({
        success: false,
        error: { code: "NOT_READY", message: "Video is not ready for publishing" },
      });
    }

    const publishedAt = visibility === "SCHEDULED" && scheduledAt
      ? new Date(scheduledAt)
      : new Date();

    const { updated, outboxId } = await prisma.$transaction(async (tx) => {
      const updated = await tx.video.update({
        where: { id },
        data: {
          visibility: visibility as any,
          publishedAt,
          scheduledAt: visibility === "SCHEDULED" ? new Date(scheduledAt!) : null,
        },
        select: {
          id: true,
          visibility: true,
          publishedAt: true,
          scheduledAt: true,
          channelId: true, // Needed for result
        },
      });

      // Increment channel video count
      if (visibility !== "SCHEDULED") {
        await tx.channel.update({
          where: { id: video.channelId },
          data: { videoCount: { increment: 1 } },
        });
      }

      // Emit event (with outbox pattern for reliability)
      // Returns outboxId because we passed 'tx'
      const outboxId = await emitVideoPublished(
        id!,
        video.channelId,
        video.title,
        video.thumbnailUrl,
        video.duration,
        visibility,
        tx
      );
      
      return { updated, outboxId };
    });
    
    // Attempt immediate delivery (fire and forget / independent)
    if (outboxId) {
      processOutboxItem(outboxId as string).catch(err => 
        console.error("Failed to process outbox item immediately:", err)
      );
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Publish video error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to publish video" },
    });
  }
});

// DELETE /videos/:id - Soft delete video
router.delete("/:id", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;

    const video = await prisma.video.findUnique({
      where: { id },
      select: {
        channelId: true,
        visibility: true,
        channel: { select: { userId: true } },
      },
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found" },
      });
    }

    if (video.channel.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not your video" },
      });
    }

    // Soft delete
    await prisma.video.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Decrement channel video count if was public
    if (video.visibility === "PUBLIC") {
      await prisma.channel.update({
        where: { id: video.channelId },
        data: { videoCount: { decrement: 1 } },
      });
    }

    // Emit event
    emitVideoDeleted(id!, video.channelId);

    res.json({ success: true, data: { message: "Video deleted" } });
  } catch (error) {
    console.error("Delete video error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to delete video" },
    });
  }
});

export default router;
