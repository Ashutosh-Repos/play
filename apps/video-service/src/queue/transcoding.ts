// BullMQ transcoding queue
import { Queue } from "bullmq";
import { redis } from "../lib/redis.js";

export const transcodingQueue = new Queue("transcoding", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
});

export interface TranscodeJobData {
  videoId: string;
  inputPath: string;
}

/**
 * Add a transcoding job to the queue
 */
export async function addTranscodeJob(videoId: string, inputPath: string): Promise<void> {
  await transcodingQueue.add(
    "transcode",
    { videoId, inputPath } as TranscodeJobData,
    {
      jobId: videoId, // Use videoId as job ID for deduplication
    }
  );
  console.log(`📤 Added transcode job for video: ${videoId}`);
}
