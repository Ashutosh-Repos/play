import { Queue } from "bullmq";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const transcodingQueue = new Queue("transcoding", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100, // Keep last 100 successful jobs
    removeOnFail: 1000,   // Keep last 1000 failed jobs for debugging
  },
});

export interface TranscodeJobData {
  videoId: string;
  fileName: string;
}
