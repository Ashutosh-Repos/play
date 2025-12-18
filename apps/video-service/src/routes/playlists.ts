// Playlist routes - CRUD and video management
import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "@repo/database";
import { authMiddleware } from "@repo/common";
import {
  createPlaylistSchema,
  updatePlaylistSchema,
  addVideoToPlaylistSchema,
  reorderPlaylistVideosSchema,
} from "../schemas.js";

const router = Router();

// Optional auth middleware - sets req.user if token present, but doesn't require it
const optionalAuthMiddleware = () => {
  return (req: Request, _res: Response, next: NextFunction) => {
    // For now, just pass through. In a real implementation,
    // you would try to verify JWT if present.
    // TODO: Implement proper optional auth by checking Authorization header
    next();
  };
};

// GET /playlists/me - My playlists
router.get("/me", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const cursor = req.query.cursor as string | undefined;

    const playlists = await prisma.playlist.findMany({
      where: { userId },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        thumbnailUrl: true,
        isSystem: true,
        systemType: true,
        videoCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const hasMore = playlists.length > limit;
    const items = hasMore ? playlists.slice(0, -1) : playlists;

    res.json({
      success: true,
      data: {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : null,
      },
    });
  } catch (error) {
    console.error("Get my playlists error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get playlists" },
    });
  }
});

// POST /playlists - Create playlist
router.post("/", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;

    const parsed = createPlaylistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { title, description, visibility } = parsed.data;

    const playlist = await prisma.playlist.create({
      data: {
        userId,
        title,
        description,
        visibility: visibility || "PRIVATE",
      },
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        videoCount: true,
        createdAt: true,
      },
    });

    res.status(201).json({ success: true, data: playlist });
  } catch (error) {
    console.error("Create playlist error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to create playlist" },
    });
  }
});

// GET /playlists/:id - Get playlist with videos
router.get("/:id", optionalAuthMiddleware(), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.sub;

    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, displayName: true },
        },
        videos: {
          orderBy: { position: "asc" },
          take: 100,
          include: {
            video: {
              select: {
                id: true,
                title: true,
                thumbnailUrl: true,
                duration: true,
                visibility: true,
                channelName: true,
                channelHandle: true,
                viewCount: true,
                publishedAt: true,
              },
            },
          },
        },
      },
    });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Playlist not found" },
      });
    }

    // Check visibility
    if (playlist.visibility === "PRIVATE" && playlist.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Playlist not found" },
      });
    }

    // Filter out private videos for non-owners
    const isOwner = playlist.userId === userId;
    const videos = playlist.videos
      .filter((pv: typeof playlist.videos[0]) => isOwner || pv.video.visibility === "PUBLIC" || pv.video.visibility === "UNLISTED")
      .map((pv: typeof playlist.videos[0]) => ({
        position: pv.position,
        addedAt: pv.addedAt,
        ...pv.video,
      }));

    res.json({
      success: true,
      data: {
        ...playlist,
        videos,
        isOwner,
      },
    });
  } catch (error) {
    console.error("Get playlist error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get playlist" },
    });
  }
});

// PATCH /playlists/:id - Update playlist
router.patch("/:id", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;

    const parsed = updatePlaylistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    // Check ownership
    const playlist = await prisma.playlist.findUnique({
      where: { id },
      select: { userId: true, isSystem: true },
    });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Playlist not found" },
      });
    }

    if (playlist.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not authorized" },
      });
    }

    // Don't allow updating system playlists (Watch Later, Liked)
    if (playlist.isSystem) {
      return res.status(400).json({
        success: false,
        error: { code: "SYSTEM_PLAYLIST", message: "Cannot modify system playlist" },
      });
    }

    const updated = await prisma.playlist.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        thumbnailUrl: true,
        updatedAt: true,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update playlist error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update playlist" },
    });
  }
});

// DELETE /playlists/:id - Delete playlist
router.delete("/:id", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;

    const playlist = await prisma.playlist.findUnique({
      where: { id },
      select: { userId: true, isSystem: true },
    });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Playlist not found" },
      });
    }

    if (playlist.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not authorized" },
      });
    }

    if (playlist.isSystem) {
      return res.status(400).json({
        success: false,
        error: { code: "SYSTEM_PLAYLIST", message: "Cannot delete system playlist" },
      });
    }

    await prisma.playlist.delete({ where: { id } });

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("Delete playlist error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to delete playlist" },
    });
  }
});

// POST /playlists/:id/videos - Add video to playlist
router.post("/:id/videos", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;

    const parsed = addVideoToPlaylistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { videoId } = parsed.data;

    // Check playlist ownership
    const playlist = await prisma.playlist.findUnique({
      where: { id },
      select: { userId: true, videoCount: true },
    });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Playlist not found" },
      });
    }

    if (playlist.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not authorized" },
      });
    }

    // Check video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId, deletedAt: null },
      select: { id: true, thumbnailUrl: true },
    });

    if (!video) {
      return res.status(400).json({
        success: false,
        error: { code: "VIDEO_NOT_FOUND", message: "Video not found" },
      });
    }

    // Check if already in playlist
    const playlistId = id as string;
    const existing = await prisma.playlistVideo.findUnique({
      where: { playlistId_videoId: { playlistId, videoId } },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: { code: "ALREADY_EXISTS", message: "Video already in playlist" },
      });
    }

    // Add video at the end
    const newPosition = playlist.videoCount;

    await prisma.$transaction([
      prisma.playlistVideo.create({
        data: {
          playlistId: id as string,
          videoId,
          position: newPosition,
        },
      }),
      prisma.playlist.update({
        where: { id },
        data: {
          videoCount: { increment: 1 },
          // Update thumbnail if first video
          ...(playlist.videoCount === 0 && video.thumbnailUrl
            ? { thumbnailUrl: video.thumbnailUrl }
            : {}),
        },
      }),
    ]);

    res.status(201).json({
      success: true,
      data: { added: true, position: newPosition },
    });
  } catch (error) {
    console.error("Add video to playlist error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to add video" },
    });
  }
});

// DELETE /playlists/:id/videos/:videoId - Remove video from playlist
router.delete("/:id/videos/:videoId", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id, videoId } = req.params;

    // Check ownership
    const playlist = await prisma.playlist.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Playlist not found" },
      });
    }

    if (playlist.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not authorized" },
      });
    }

    // Remove video
    const deleted = await prisma.playlistVideo.deleteMany({
      where: { playlistId: id, videoId },
    });

    if (deleted.count === 0) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not in playlist" },
      });
    }

    // Update count
    await prisma.playlist.update({
      where: { id },
      data: { videoCount: { decrement: 1 } },
    });

    res.json({ success: true, data: { removed: true } });
  } catch (error) {
    console.error("Remove video from playlist error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to remove video" },
    });
  }
});

// PATCH /playlists/:id/videos/reorder - Reorder videos
router.patch("/:id/videos/reorder", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;

    const parsed = reorderPlaylistVideosSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { videoIds } = parsed.data;

    // Check ownership
    const playlist = await prisma.playlist.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Playlist not found" },
      });
    }

    if (playlist.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not authorized" },
      });
    }

    // Update positions
    await prisma.$transaction(
      videoIds.map((videoId, index) =>
        prisma.playlistVideo.updateMany({
          where: { playlistId: id, videoId },
          data: { position: index },
        })
      )
    );

    res.json({ success: true, data: { reordered: true } });
  } catch (error) {
    console.error("Reorder playlist error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to reorder" },
    });
  }
});

export default router;
