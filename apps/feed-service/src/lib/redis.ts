import Redis from "ioredis";
import { serverEnv } from "@repo/config";

export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

redis.on("error", (err: Error) => console.error("Redis Client Error:", err));
redis.on("connect", () => console.log("✅ Redis Connected (Feed Service)"));
