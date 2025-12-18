// S3 Event Handler for MinIO notifications
// This handles MinIO bucket notifications when objects are uploaded
import { Router } from "express";
import { prisma } from "@repo/database";
import { extractVideoIdFromPath, getObjectStat } from "../lib/minio.js";
import { cacheVideoStatus, publishToVideoChannel } from "../lib/redis.js";
import { addTranscodeJob } from "../queue/transcoding.js";

const router = Router();

// MinIO S3 Event payload structure
interface S3Event {
  EventName: string;
  Key: string;
  Records?: Array<{
    eventName: string;
    s3: {
      bucket: { name: string };
      object: { key: string; size: number };
    };
  }>;
}

/**
 * POST /internal/s3-events
 * Webhook endpoint for MinIO bucket notifications
 * Configure MinIO to send events here: mc event add myminio/play-videos arn:minio:sqs::1:webhook --event put
 */
router.post("/", async (req, res) => {
  try {
    const event = req.body as S3Event;
    
    // Handle different event formats (MinIO can send in different ways)
    let objectKey: string;
    let objectSize: number | undefined;
    
    if (event.Records && event.Records.length > 0) {
      // Standard S3 event format
      const record = event.Records[0];
      objectKey = decodeURIComponent(record!.s3.object.key);
      objectSize = record!.s3.object.size;
    } else if (event.Key) {
      // Simplified format
      objectKey = event.Key;
    } else {
      console.warn("Unknown S3 event format:", event);
      return res.status(200).json({ ok: true }); // Ack anyway
    }
    
    // Only handle object creation events
    const eventName = event.EventName || event.Records?.[0]?.eventName || "";
    if (!eventName.includes("Put") && !eventName.includes("Created")) {
      return res.status(200).json({ ok: true });
    }
    
    // Extract videoId from path (uploads/{videoId}/original)
    const videoId = extractVideoIdFromPath(objectKey);
    if (!videoId) {
      console.log(`Ignoring non-video object: ${objectKey}`);
      return res.status(200).json({ ok: true });
    }
    
    console.log(`📦 S3 event: ${eventName} for video ${videoId}`);
    
    // Get file size if not in event
    if (!objectSize) {
      try {
        const stat = await getObjectStat(objectKey);
        objectSize = stat.size;
      } catch {
        objectSize = 0;
      }
    }
    
    // Update video with conditional check (idempotent)
    const updated = await prisma.video.updateMany({
      where: {
        id: videoId,
        processingStatus: "UPLOADING",
      },
      data: {
        processingStatus: "PROCESSING",
        originalFilePath: objectKey,
        originalFileSize: objectSize,
      },
    });
    
    if (updated.count === 0) {
      // Already processed or doesn't exist
      console.log(`Video ${videoId} already processed or not found`);
      return res.status(200).json({ ok: true });
    }
    
    // Add transcode job
    await addTranscodeJob(videoId, objectKey);
    
    // Update cache
    await cacheVideoStatus(videoId, {
      status: "processing",
      progress: 0,
    });
    
    // Broadcast to WebSocket
    await publishToVideoChannel(videoId, {
      type: "state",
      status: "processing",
      progress: 0,
    });
    
    console.log(`✅ Video ${videoId} queued for transcoding`);
    res.status(200).json({ ok: true, videoId });
  } catch (error) {
    console.error("S3 event error:", error);
    // Still return 200 to prevent MinIO from retrying
    res.status(200).json({ ok: true, error: "Processing failed" });
  }
});

export default router;
