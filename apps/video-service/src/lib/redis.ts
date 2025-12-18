// Redis client for caching and Pub/Sub
import { Redis } from "ioredis";
import { config } from "../config.js";

// Main Redis client for caching
export const redis = new Redis(config.redisUrl);

// Separate client for Pub/Sub subscriber (subscriber can't be used for other commands)
export const redisSub = new Redis(config.redisUrl);

// Pub client (can use main redis client)
export const redisPub = redis;

redis.on("connect", () => {
  console.log("🔴 Redis connected");
});

redis.on("error", (err: Error) => {
  console.error("Redis error:", err);
});

// Redis key prefixes
export const REDIS_KEYS = {
  videoStatus: (videoId: string) => `video:${videoId}:status`,
  videoWsChannel: (videoId: string) => `video:${videoId}:ws`,
  rateLimit: (ip: string, action: string) => `rate:${ip}:${action}`,
};

// Video status cache
export interface VideoStatusCache {
  status: string;
  progress?: number;
  thumbnails?: string[];
  hlsUrl?: string;
  error?: string;
}

/**
 * Cache video status
 */
export async function cacheVideoStatus(
  videoId: string,
  status: VideoStatusCache
): Promise<void> {
  const key = REDIS_KEYS.videoStatus(videoId);
  await redis.set(key, JSON.stringify(status), "EX", 24 * 60 * 60); // 24h TTL
}

/**
 * Get cached video status
 */
export async function getCachedVideoStatus(
  videoId: string
): Promise<VideoStatusCache | null> {
  const key = REDIS_KEYS.videoStatus(videoId);
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Publish to video WebSocket channel (all instances will receive)
 */
export async function publishToVideoChannel(
  videoId: string,
  message: object
): Promise<void> {
  const channel = REDIS_KEYS.videoWsChannel(videoId);
  await redisPub.publish(channel, JSON.stringify(message));
}

/**
 * Subscribe to video WebSocket channel
 */
export function subscribeToVideoChannel(
  videoId: string,
  callback: (message: object) => void
): void {
  const channel = REDIS_KEYS.videoWsChannel(videoId);
  
  redisSub.subscribe(channel).catch((err: Error) => {
    console.error(`Failed to subscribe to ${channel}:`, err);
  });
  
  redisSub.on("message", (ch: string, message: string) => {
    if (ch === channel) {
      try {
        callback(JSON.parse(message));
      } catch (e) {
        console.error("Failed to parse Redis message:", e);
      }
    }
  });
}

/**
 * Unsubscribe from video channel
 */
export function unsubscribeFromVideoChannel(videoId: string): void {
  const channel = REDIS_KEYS.videoWsChannel(videoId);
  redisSub.unsubscribe(channel);
}
