import { Queue } from "bullmq";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

// Job timeout: 45 minutes max for long videos (used in worker.ts)
export const JOB_TIMEOUT_MS = 45 * 60 * 1000;

export const transcodingQueue = new Queue("transcoding", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,       // Keep last 100 successful jobs
    removeOnFail: 1000,          // Keep last 1000 failed jobs for debugging
  },
});

export interface TranscodeJobData {
  videoId: string;
  fileName: string;
}

/**
 * Check if a job already exists for this videoId (deduplication)
 */
export async function jobExistsForVideo(videoId: string): Promise<boolean> {
  const jobs = await transcodingQueue.getJobs(["active", "waiting", "delayed"]);
  return jobs.some(job => job.data?.videoId === videoId);
}
