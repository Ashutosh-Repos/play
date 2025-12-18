// Upload routes - video upload initiation and completion
import { Router } from "express";
import { prisma } from "@repo/database";
import { authMiddleware } from "@repo/common";
import { uploadVideoSchema } from "../schemas.js";
import { getPresignedUploadUrl, getVideoPath, objectExists, getObjectStat, deleteObjectsWithPrefix } from "../lib/minio.js";
import { cacheVideoStatus } from "../lib/redis.js";
import { config } from "../config.js";
import { emitVideoDeleted, emitVideoUploaded } from "../events/publisher.js";

const router = Router();

/**
 * POST /videos/upload
 * Create video record and get presigned upload URL
 */
router.post("/", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;

    // Validate input
    const parsed = uploadVideoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { fileName } = parsed.data;

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

    // Calculate expiry time
    const uploadExpiresAt = new Date(Date.now() + config.upload.presignedUrlExpiry * 1000);

    // Create video record
    const video = await prisma.video.create({
      data: {
        channelId: channel.id,
        title: fileName.replace(/\.[^/.]+$/, ""), // Remove extension for title
        processingStatus: "UPLOADING",
        visibility: "PRIVATE",
        // Denormalized channel info
        channelHandle: channel.handle,
        channelName: channel.displayName,
        channelAvatarUrl: channel.avatarUrl,
        // Upload tracking
        originalFileName: fileName,
        uploadExpiresAt: uploadExpiresAt,
        uploadStartedAt: new Date(),
        uploadAttempts: 0,
      },
      select: {
        id: true,
        title: true,
        processingStatus: true,
        createdAt: true,
      },
    });

    // Generate presigned URL
    const uploadUrl = await getPresignedUploadUrl(video.id);

    // Cache initial status
    await cacheVideoStatus(video.id, {
      status: "uploading",
      progress: 0,
    });

    // WebSocket URL (relative, will be upgraded by server)
    const wsUrl = `/ws/videos/${video.id}`;

    res.status(201).json({
      success: true,
      data: {
        videoId: video.id,
        uploadUrl,
        wsUrl,
        expiresAt: uploadExpiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Upload init error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to initiate upload" },
    });
  }
});

/**
 * POST /videos/:id/retry
 * Get a new presigned URL for an existing video (if upload failed)
 */
router.post("/:id/retry", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;
    
    // Get video
    const video = await prisma.video.findUnique({
      where: { id },
      include: { channel: { select: { userId: true } } },
    });
    
    if (!video) {
        return res.status(404).json({
            success: false,
            error: { code: "NOT_FOUND", message: "Video not found" },
        });
    }

    // Check ownership
    if (video.channel.userId !== userId) {
        return res.status(403).json({
            success: false,
            error: { code: "FORBIDDEN", message: "Not authorized" },
        });
    }

    // Ensure video is in a state that allows retry (UPLOADING or FAILED)
    if (video.processingStatus !== "UPLOADING" && video.processingStatus !== "FAILED") {
       return res.status(400).json({
         success: false,
         error: { code: "INVALID_STATE", message: `Cannot retry upload for video in status ${video.processingStatus}` },
       });
    }

    // Calculate new expiry time
    const uploadExpiresAt = new Date(Date.now() + config.upload.presignedUrlExpiry * 1000);

    // Update video record (refresh expiry)
    await prisma.video.update({
        where: { id },
        data: {
            uploadExpiresAt,
            // Reset attempts if it was failed?? Or keep logic simple.
            // Let's just update expiry.
            processingStatus: "UPLOADING", // Reset status to uploading if it was failed
            processingError: null,
        },
    });

    // Generate new presigned URL
    const uploadUrl = await getPresignedUploadUrl(video.id);
    const wsUrl = `/ws/videos/${video.id}`;

    res.json({
      success: true,
      data: {
        videoId: video.id,
        uploadUrl,
        wsUrl,
        expiresAt: uploadExpiresAt.toISOString(),
      },
    });

  } catch (error) {
    console.error("Retry upload error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to generate retry URL" },
    });
  }
});

/**
 * POST /videos/:id/uploaded
 * Client confirms upload is complete (fallback if S3 event is lost)
 */
router.post("/:id/uploaded", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;

    // Get video
    const video = await prisma.video.findUnique({
      where: { id },
      include: { channel: { select: { userId: true } } },
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found" },
      });
    }

    // Check for soft-deletion (user deleted while uploading)
    if (video.deletedAt) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video was deleted" },
      });
    }

    // Check ownership
    if (video.channel.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not authorized" },
      });
    }

    // If already processing or beyond, return current status
    if (video.processingStatus !== "UPLOADING") {
      return res.json({
        success: true,
        data: { status: video.processingStatus },
      });
    }

    // Check if file exists in MinIO
    const objectPath = getVideoPath(id as string);
    const exists = await objectExists(objectPath);

    if (!exists) {
      return res.status(400).json({
        success: false,
        error: { code: "FILE_NOT_FOUND", message: "Upload not complete" },
      });
    }

    // Get file metadata
    const stat = await getObjectStat(objectPath);

    // Update video with conditional check (prevents race)
    const updated = await prisma.video.updateMany({
      where: {
        id,
        processingStatus: "UPLOADING", // Only update if still uploading
      },
      data: {
        processingStatus: "PROCESSING",
        originalFilePath: objectPath,
        originalFileSize: stat.size,
        uploadCompletedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      // Already processed by S3 event
      const current = await prisma.video.findUnique({
        where: { id },
        select: { processingStatus: true },
      });
      return res.json({
        success: true,
        data: { status: current?.processingStatus },
      });
    }

    // Emit rabbitmq event for transcoder
    emitVideoUploaded(
      id as string,
      userId,
      video.originalFileName || "unknown",
      Number(stat.size),
      "video/mp4" // Assuming mp4 for now or from DB if available
    );

    // Update cache
    await cacheVideoStatus(id as string, {
      status: "processing",
      progress: 0,
    });

    res.json({
      success: true,
      data: { status: "PROCESSING" },
    });
  } catch (error) {
    console.error("Upload complete error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to process upload" },
    });
  }
});

/**
 * DELETE /videos/:id
 * Cancel upload or delete video
 */
router.delete("/:id", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;

    // Get video
    const video = await prisma.video.findUnique({
      where: { id },
      include: { channel: { select: { userId: true } } },
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found" },
      });
    }

    // Check ownership
    if (video.channel.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not authorized" },
      });
    }

    // Delete MinIO files
    try {
      await deleteObjectsWithPrefix(`uploads/${id}/`);
      await deleteObjectsWithPrefix(`processed/${id}/`);
    } catch (e) {
      // Ignore - files might not exist
    }

    // Soft delete video
    await prisma.video.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Emit video.deleted event for feed/search cleanup
    await emitVideoDeleted(id as string, video.channelId);

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error("Delete video error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to delete video" },
    });
  }
});

export default router;
