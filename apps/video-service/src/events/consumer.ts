// RabbitMQ event consumer for video-service
// Consumes transcoder events to update video status and broadcast via WebSocket
import * as amqp from "amqplib";
import { prisma } from "@repo/database";
import { EXCHANGES } from "@repo/events";
import { cacheVideoStatus, publishToVideoChannel } from "../lib/redis.js";
import { config } from "../config.js";

let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
let channel: amqp.Channel | null = null;

const QUEUE_NAME = "video-service.transcoder-events";

// Event types
interface TranscodeProgressEvent {
  type: "transcode.progress";
  payload: {
    videoId: string;
    progress: number;
    stage: string;
  };
}

interface TranscodeThumbnailsEvent {
  type: "transcode.thumbnails";
  payload: {
    videoId: string;
    thumbnailOptions: string[];
  };
}

interface TranscodeCompletedEvent {
  type: "transcode.completed";
  payload: {
    videoId: string;
    hlsPlaylistUrl: string;
    thumbnailOptions: string[];
    previewSprite?: string;
    duration: number;
    width: number;
    height: number;
    fps: number;
    resolutions: string[];
  };
}

interface TranscodeFailedEvent {
  type: "transcode.failed";
  payload: {
    videoId: string;
    error: string;
    stage: string;
    retryable: boolean;
  };
}

type TranscoderEvent = 
  | TranscodeProgressEvent 
  | TranscodeThumbnailsEvent 
  | TranscodeCompletedEvent 
  | TranscodeFailedEvent;

export async function startConsumer(): Promise<void> {
  const url = config.rabbitmqUrl;

  try {
    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    // Declare exchange and queue
    await channel.assertExchange(EXCHANGES.VIDEO, "topic", { durable: true });
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    // Bind to transcoder events
    await channel.bindQueue(QUEUE_NAME, EXCHANGES.VIDEO, "transcode.progress");
    await channel.bindQueue(QUEUE_NAME, EXCHANGES.VIDEO, "transcode.thumbnails");
    await channel.bindQueue(QUEUE_NAME, EXCHANGES.VIDEO, "transcode.completed");
    await channel.bindQueue(QUEUE_NAME, EXCHANGES.VIDEO, "transcode.failed");
    
    // Legacy event names (backward compat)
    await channel.bindQueue(QUEUE_NAME, EXCHANGES.VIDEO, "video.transcoded");
    await channel.bindQueue(QUEUE_NAME, EXCHANGES.VIDEO, "video.transcode.failed");

    // Consume messages
    await channel.consume(QUEUE_NAME, handleMessage, { noAck: false });

    console.log("✅ video-service consumer started");
  } catch (error) {
    console.error("❌ Failed to start consumer:", error);
    throw error;
  }
}

async function handleMessage(msg: amqp.ConsumeMessage | null): Promise<void> {
  if (!msg || !channel) return;

  try {
    const event = JSON.parse(msg.content.toString()) as TranscoderEvent;

    switch (event.type) {
      case "transcode.progress":
        await handleProgress(event);
        break;
      case "transcode.thumbnails":
        await handleThumbnails(event);
        break;
      case "transcode.completed":
      case "video.transcoded" as string:
        await handleCompleted(event as TranscodeCompletedEvent);
        break;
      case "transcode.failed":
      case "video.transcode.failed" as string:
        await handleFailed(event as TranscodeFailedEvent);
        break;
      default:
        console.log("Unknown event type:", (event as { type: string }).type);
    }

    channel.ack(msg);
  } catch (error) {
    console.error("Error handling message:", error);
    // Requeue on error to prevent data loss (DLQ would be better but simple retry helps)
    // Warning: persistent errors will loop. In prod, use DLQ or retry count.
    channel.nack(msg, false, true); 
  }
}

/**
 * Handle transcode progress - update cache and broadcast
 */
async function handleProgress(event: TranscodeProgressEvent): Promise<void> {
  const { videoId, progress, stage } = event.payload;

  // Update cache
  await cacheVideoStatus(videoId, {
    status: "processing",
    progress,
  });

  // Broadcast to WebSocket clients
  await publishToVideoChannel(videoId, {
    type: "progress",
    status: "processing",
    progress,
    stage,
  });

  // Optionally update DB (less frequently)
  if (progress % 25 === 0) {
    await prisma.video.update({
      where: { id: videoId },
      data: { processingProgress: progress },
    });
  }
}

/**
 * Handle thumbnails generated - update DB and broadcast
 */
async function handleThumbnails(event: TranscodeThumbnailsEvent): Promise<void> {
  const { videoId, thumbnailOptions } = event.payload;

  // Update DB
  await prisma.video.update({
    where: { id: videoId },
    data: { thumbnailOptions },
  });

  // Update cache
  await cacheVideoStatus(videoId, {
    status: "processing",
    thumbnails: thumbnailOptions,
  });

  // Broadcast to WebSocket clients
  await publishToVideoChannel(videoId, {
    type: "thumbnails",
    thumbnails: thumbnailOptions,
  });

  console.log(`📷 Thumbnails generated for video ${videoId}`);
}

/**
 * Handle transcode completed - update DB and broadcast
 */
async function handleCompleted(event: TranscodeCompletedEvent): Promise<void> {
  const { 
    videoId, 
    hlsPlaylistUrl, 
    thumbnailOptions, 
    previewSprite, 
    duration, 
    width, 
    height, 
    fps, 
    resolutions 
  } = event.payload;

  // Idempotent check
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { 
      processingStatus: true,
      deletedAt: true 
    },
  });

  if (!video) {
    console.warn(`Video ${videoId} not found, skipping`);
    return;
  }

  // Abort if video is soft-deleted (user deleted it while transcoding)
  if (video.deletedAt) {
    console.warn(`Video ${videoId} is deleted, aborting completion`);
    return;
  }

  if (video.processingStatus === "READY") {
    console.log(`Video ${videoId} already READY (idempotent)`);
    return;
  }

  // Update DB
  await prisma.video.update({
    where: { id: videoId },
    data: {
      processingStatus: "READY",
      processingProgress: 100,
      hlsPlaylistUrl,
      thumbnailUrl: thumbnailOptions[0], // Default to first thumbnail
      thumbnailOptions,
      previewSprite,
      duration,
      width,
      height,
      fps,
      resolutions,
    },
  });

  // Update cache
  await cacheVideoStatus(videoId, {
    status: "ready",
    progress: 100,
    thumbnails: thumbnailOptions,
    hlsUrl: hlsPlaylistUrl,
  });

  // Broadcast to WebSocket clients
  await publishToVideoChannel(videoId, {
    type: "state",
    status: "ready",
    progress: 100,
    thumbnails: thumbnailOptions,
    hlsUrl: hlsPlaylistUrl,
    canPublish: true,
  });

  // Emit domain event for other services (Search/Feed)
  // Need channelId for the event payload
  const videoWithChannel = await prisma.video.findUnique({
    where: { id: videoId },
    select: { channelId: true }
  });
  
  if (videoWithChannel) {
    const { emitVideoUpdated } = await import("../events/publisher.js");
    emitVideoUpdated(videoId, videoWithChannel.channelId, ["processingStatus", "hlsPlaylistUrl", "thumbnailUrl"]);
  }

  console.log(`✅ Video ${videoId} transcoding complete`);
}

/**
 * Handle transcode failed - update DB and broadcast
 */
async function handleFailed(event: TranscodeFailedEvent): Promise<void> {
  const { videoId, error, retryable } = event.payload;

  // Idempotent check
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { processingStatus: true },
  });

  if (!video) {
    console.warn(`Video ${videoId} not found, skipping`);
    return;
  }

  if (video.processingStatus === "FAILED") {
    console.log(`Video ${videoId} already FAILED (idempotent)`);
    return;
  }

  // Race Condition Fix: If video is already READY, ignore this late failure message
  if (video.processingStatus === "READY") {
    console.warn(`Video ${videoId} is READY, ignoring late failure message`);
    return;
  }

  // If retryable, increment attempts (handled by BullMQ, we just log)
  // Update DB
  await prisma.video.update({
    where: { id: videoId },
    data: {
      processingStatus: "FAILED",
      processingError: error,
    },
  });

  // Update cache
  await cacheVideoStatus(videoId, {
    status: "failed",
    error,
  });

  // Broadcast to WebSocket clients
  await publishToVideoChannel(videoId, {
    type: "state",
    status: "failed",
    error,
    retryable,
  });

  console.error(`❌ Video ${videoId} transcoding failed: ${error}`);
}

export async function stopConsumer(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
}
