// Internal API routes for service-to-service communication
// These endpoints are called by ingest-service and transcoder-service
import { Router } from "express";
import { prisma } from "@repo/database";
import { updateVideoUploadSchema, updateVideoTranscodeSchema } from "../schemas.js";
import { emitVideoUploaded } from "../events/publisher.js";
import { verifyServiceToken } from "@repo/common";

const router = Router();


// Middleware to protect internal routes
router.use(verifyServiceToken);

// GET /internal/videos/:id/verify-owner - Verify video ownership
// Called by ingest-service before accepting upload
router.get("/:id/verify-owner", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_USER_ID", message: "x-user-id header required" },
      });
    }

    const video = await prisma.video.findUnique({
      where: { id },
      select: {
        id: true,
        channelId: true,
        processingStatus: true,
        channel: { select: { userId: true } },
      },
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found" },
      });
    }

    const isOwner = video.channel.userId === userId;

    res.json({
      success: true,
      data: {
        valid: isOwner,
        channelId: isOwner ? video.channelId : null,
        status: video.processingStatus,
      },
    });
  } catch (error) {
    console.error("Verify owner error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to verify" },
    });
  }
});

// PATCH /internal/videos/:id/upload - Update video with upload info
// Called by ingest-service when upload completes
router.patch("/:id/upload", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate with Zod
    const parsed = updateVideoUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { status, originalFileName, originalFileSize, originalFilePath, originalMimeType, uploadId } = parsed.data;

    const video = await prisma.video.findUnique({
      where: { id },
      select: { id: true, channelId: true },
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found" },
      });
    }

    await prisma.video.update({
      where: { id },
      data: {
        processingStatus: status,
        ...(originalFileName && { originalFileName }),
        ...(originalFileSize && { originalFileSize: BigInt(originalFileSize) }),
        ...(originalFilePath && { originalFilePath }),
        ...(originalMimeType && { originalMimeType }),
        ...(uploadId && { uploadId }),
      },
    });

    // If status is PROCESSING, emit video.uploaded event to trigger transcoding
    if (status === "PROCESSING" && originalFilePath) {
      // Need userId for the event
      const videoOwner = await prisma.video.findUnique({
          where: { id },
          select: { channel: { select: { userId: true } } }
      });
      
      if (videoOwner) {
          emitVideoUploaded(
              id, 
              videoOwner.channel.userId, 
              originalFilePath,
              Number(originalFileSize || 0), 
              originalMimeType || "video/mp4"
          );
      }
    }

    res.json({ success: true, data: { message: "Upload info updated" } });
  } catch (error) {
    console.error("Update upload info error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update" },
    });
  }
});

// PATCH /internal/videos/:id/transcode - Update video with transcode results
// Called by consumer when transcoder completes (alternative to event)
router.patch("/:id/transcode", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate with Zod
    const parsed = updateVideoTranscodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const video = await prisma.video.findUnique({
      where: { id },
      select: { id: true, processingStatus: true },
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found" },
      });
    }

    // Idempotent: skip if already in final state
    if (video.processingStatus === "READY" || video.processingStatus === "FAILED") {
      return res.json({ success: true, data: { message: "Already updated" } });
    }

    await prisma.video.update({
      where: { id },
      data: parsed.data,
    });

    res.json({ success: true, data: { message: "Transcode info updated" } });
  } catch (error) {
    console.error("Update transcode info error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update" },
    });
  }
});

export default router;
