import { Redis } from "ioredis";
import { serverEnv } from "@repo/config";

// Redis client for general caching and engagement buffering
export const redis = new Redis(serverEnv.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

redis.on("connect", () => {
  console.log("✅ Engagement Service connected to Redis");
});
