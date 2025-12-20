// Redis client for user-service caching
import { Redis } from "ioredis";
import { serverEnv } from "@repo/config";

export const redis = new Redis(serverEnv.REDIS_URL);

// Cache TTLs (in seconds)
const CACHE_TTL = {
  CHANNEL: 60 * 5,      // 5 minutes for channel data
  USER: 60 * 5,         // 5 minutes for user data
  SUBSCRIPTION: 60 * 2, // 2 minutes for subscription status
};

// Channel caching helpers
export async function getCachedChannel(handle: string) {
  const cached = await redis.get(`channel:${handle.toLowerCase()}`);
  return cached ? JSON.parse(cached) : null;
}

export async function cacheChannel(handle: string, data: object) {
  await redis.set(
    `channel:${handle.toLowerCase()}`,
    JSON.stringify(data),
    "EX",
    CACHE_TTL.CHANNEL
  );
}

export async function invalidateChannelCache(handle: string) {
  await redis.del(`channel:${handle.toLowerCase()}`);
}

// User caching helpers
export async function getCachedUser(userId: string) {
  const cached = await redis.get(`user:${userId}`);
  return cached ? JSON.parse(cached) : null;
}

export async function cacheUser(userId: string, data: object) {
  await redis.set(
    `user:${userId}`,
    JSON.stringify(data),
    "EX",
    CACHE_TTL.USER
  );
}

export async function invalidateUserCache(userId: string) {
  await redis.del(`user:${userId}`);
}

// Subscription status caching
export async function getCachedSubscriptionStatus(userId: string, channelId: string) {
  const cached = await redis.get(`sub:${userId}:${channelId}`);
  return cached ? JSON.parse(cached) : null;
}

export async function cacheSubscriptionStatus(userId: string, channelId: string, subscribed: boolean) {
  await redis.set(
    `sub:${userId}:${channelId}`,
    JSON.stringify({ subscribed }),
    "EX",
    CACHE_TTL.SUBSCRIPTION
  );
}

export async function invalidateSubscriptionCache(userId: string, channelId: string) {
  await redis.del(`sub:${userId}:${channelId}`);
}
