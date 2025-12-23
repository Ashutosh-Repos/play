import { Worker, Job, UnrecoverableError } from "bullmq";
import { Redis } from "ioredis";
import path from "path";
import fs from "fs-extra";
import { downloadVideo, uploadArtifacts, uploadThumbnails } from "./storage.js";
import { transcodeVideo, getVideoMetadata, generateThumbnails, getTargetResolutions } from "./transcoder.js";
import { TranscodeJobData, JOB_TIMEOUT_MS } from "./queue.js";
import { EXCHANGES } from "@repo/events";
import amqp, { Channel } from "amqplib";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

import { serverEnv } from "@repo/config";

// Read at runtime, not module load time
const getRabbitMQUrl = () => serverEnv.RABBITMQ_URL;

let rabbitChannel: Channel;
let rabbitConnection: any = null;  // amqplib.Connection
let worker: Worker<TranscodeJobData> | null = null;
let isShuttingDown = false;

// Initialize separate RabbitMQ publisher for the worker
const initRabbitMQ = async () => {
  try {
    rabbitConnection = await amqp.connect(getRabbitMQUrl());
    rabbitChannel = await rabbitConnection.createChannel();
    await rabbitChannel.assertExchange(EXCHANGES.VIDEO, "topic", { durable: true });
    console.log("✅ Worker RabbitMQ publisher initialized");
  } catch (err) {
    console.error("Failed to connect Worker RabbitMQ:", err);
  }
};

const publishEvent = (exchange: string, routingKey: string, event: object) => {
  if (!rabbitChannel) {
    console.warn("RabbitMQ channel not ready, skipping event:", routingKey);
    return;
  }
  rabbitChannel.publish(exchange, routingKey, Buffer.from(JSON.stringify(event)));
};

export const startWorker = async () => {
  await initRabbitMQ();

  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

  console.log("🚀 Starting transcoding worker...");

  worker = new Worker<TranscodeJobData>(
    "transcoding",
    async (job: Job<TranscodeJobData>) => {
      const { videoId, fileName } = job.data;
      console.log(`[Job ${job.id}] Processing video ${videoId}`);

      const workDir = path.join(process.cwd(), "temp", `${videoId}-${job.id}`);
      // Security: path.basename strips any ".." or directory components
      const safeFileName = path.basename(fileName);
      const inputPath = path.join(workDir, "input", safeFileName);
      const outputDir = path.join(workDir, "output");

      try {
        // 1. Notify Started
        console.log(`[Pipeline] 5. Worker Started: videoId=${videoId} jobId=${job.id}`);
        publishEvent(EXCHANGES.VIDEO, "transcode.progress", {
          type: "transcode.progress",
          payload: {
            videoId,
            progress: 0,
            stage: "started",
          },
        });

        // 2. Download
        await job.updateProgress({ step: "downloading", progress: 10 });
        
        // Use the S3 Key provided in the job (fileName field carries the key)
        console.log(`[Pipeline] Downloading from Key: ${fileName}`);
        await downloadVideo(fileName, inputPath);
        
        console.log(`[Pipeline] 6. Downloaded source for ${videoId}`);
        publishEvent(EXCHANGES.VIDEO, "transcode.progress", {
          type: "transcode.progress",
          payload: {
            videoId,
            progress: 10,
            stage: "downloaded",
          },
        });

        // 3. Probe Metadata
        console.log(`Probing video ${videoId}...`);
        const metadata = await getVideoMetadata(inputPath);
        console.log("Metadata:", metadata);
        
        // ... (snip) ...

        // 4. Generate Thumbnails (before transcoding)
        await job.updateProgress({ step: "thumbnails", progress: 20 });
        console.log(`[Pipeline] Generating thumbnails for ${videoId}...`);
        const generatedThumbnails = await generateThumbnails(inputPath, outputDir, metadata.height);
        
        // Upload thumbnails immediately so users can preview while transcoding
        const uploadedThumbnails = await uploadThumbnails(videoId, outputDir, generatedThumbnails);
        
        console.log(`[Pipeline] 7. Thumbnails Ready for ${videoId}`);
        publishEvent(EXCHANGES.VIDEO, "transcode.thumbnails", {
          type: "transcode.thumbnails",
          payload: {
            videoId,
            thumbnailOptions: uploadedThumbnails,
          },
        });
        
        // 5. Transcode (adaptive based on source height)
        let lastProgress = 0;
        console.log(`[Pipeline] 8. Starting Transcoding for ${videoId}`);
        
        const transcodeResult = await transcodeVideo({
          inputPath,
          outputDir,
          sourceHeight: metadata.height,
          onProgress: (progress) => {
            // Map 0-100 to 30-80 (thumbnails took 20-30)
            const overallProgress = Math.round(30 + (progress * 0.5));
            
            // Throttle updates (every 2% overall change)
            if (overallProgress >= lastProgress + 2) {
              lastProgress = overallProgress;
              
              job.updateProgress({ step: "transcoding", progress: overallProgress });
              
              publishEvent(EXCHANGES.VIDEO, "transcode.progress", {
                type: "transcode.progress",
                payload: {
                  videoId,
                  progress: overallProgress,
                  stage: "transcoding",
                },
              });
            }
          },
          // Convert ms to seconds
          timeout: Math.floor(JOB_TIMEOUT_MS / 1000), 
        });
        
        console.log(`[Pipeline] Transcoding complete for ${videoId}. Resolutions: ${transcodeResult.resolutions.join(", ")}`);

        await job.updateProgress({ step: "transcoding_done", progress: 80 });
        
        publishEvent(EXCHANGES.VIDEO, "transcode.progress", {
          type: "transcode.progress",
          payload: {
            videoId,
            progress: 80,
            stage: "transcoded",
          },
        });

        // 6. Upload HLS artifacts (excluding already-uploaded thumbnails)
        await job.updateProgress({ step: "uploading", progress: 90 });
        const uploadedFiles = await uploadArtifacts(videoId, outputDir, [".m3u8", ".ts"]);
        console.log(`[Pipeline] 9. HLS Artifacts Uploaded for ${videoId}`);

        // 7. Cleanup working directory
        await fs.remove(workDir);

        // 8. Notify Completed
        const hlsPlaylistUrl = uploadedFiles.find(f => f.endsWith("master.m3u8")) || "";
        
        if (!hlsPlaylistUrl) {
          throw new Error("Master playlist not found in uploaded artifacts");
        }

        publishEvent(EXCHANGES.VIDEO, "transcode.completed", {
          type: "transcode.completed",
          payload: {
            videoId,
            hlsPlaylistUrl,
            thumbnailOptions: uploadedThumbnails,
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height,
            fps: metadata.fps,
            resolutions: transcodeResult.resolutions,
          },
        });

        console.log(`[Pipeline] ✅ [Job ${job.id}] Transcoding pipeline finished for ${videoId}`);
        return { success: true, hlsPlaylistUrl, thumbnailUrls: uploadedThumbnails };
      } catch (error: any) {
        console.error(`❌ [Job ${job.id}] Failed:`, error);
        
        const errorMsg = error.message || "Unknown error";
        
        // Determine if error is fatal (UnrecoverableError or specific patterns)
        const isFatal = 
          error instanceof UnrecoverableError ||
          errorMsg.includes("Invalid data found") || 
          errorMsg.includes("End of file") || 
          errorMsg.includes("Response code 404") ||
          errorMsg.includes("resolution too low");

        publishEvent(EXCHANGES.VIDEO, "transcode.failed", {
          type: "transcode.failed",
          payload: {
            videoId,
            error: errorMsg,
            stage: "processing",
            retryable: !isFatal,
          },
        });

        // Cleanup working directory
        await fs.remove(workDir);
        
        // Re-throw UnrecoverableError to prevent BullMQ retries
        if (isFatal && !(error instanceof UnrecoverableError)) {
          throw new UnrecoverableError(errorMsg);
        }
        
        throw error;
      }
    },
    {
      connection,
      concurrency: 2, // Process 2 videos in parallel per instance
    }
  );
  
  // Worker event handlers
  worker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
  });
  
  worker.on("failed", (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
  });
};

/**
 * Graceful shutdown - close worker and RabbitMQ
 */
export const stopWorker = async (): Promise<void> => {
  isShuttingDown = true;
  
  if (worker) {
    console.log("Closing worker...");
    await worker.close();
  }
  
  if (rabbitChannel) {
    try {
      await rabbitChannel.close();
    } catch (err) {
      console.warn("Error closing RabbitMQ channel:", err);
    }
  }
  
  if (rabbitConnection) {
    try {
      await rabbitConnection.close();
    } catch (err) {
      console.warn("Error closing RabbitMQ connection:", err);
    }
  }
  
  console.log("👋 Transcoding worker stopped");
};
