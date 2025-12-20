// Redis client for notification-service caching
import { Redis } from "ioredis";
import { serverEnv } from "@repo/config";

export const redis = new Redis(serverEnv.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("error", (err: Error) => console.error("Redis Client Error:", err));
redis.on("connect", () => console.log("✅ Redis Connected (Notification Service)"));

// Cache TTLs (in seconds)
const CACHE_TTL = {
  NOTIFICATIONS: 60 * 2,       // 2 minutes for notification list
  UNREAD_COUNT: 60,            // 1 minute for unread count
  SETTINGS: 60 * 10,           // 10 minutes for notification settings
};

// Redis key prefixes
const KEYS = {
  notifications: (userId: string, page: number) => `notif:list:${userId}:${page}`,
  unreadCount: (userId: string) => `notif:unread:${userId}`,
  settings: (userId: string) => `notif:settings:${userId}`,
};

// Notification List Caching
export async function cacheNotifications(userId: string, page: number, notifications: object[]): Promise<void> {
  await redis.set(KEYS.notifications(userId, page), JSON.stringify(notifications), "EX", CACHE_TTL.NOTIFICATIONS);
}

export async function getCachedNotifications(userId: string, page: number): Promise<object[] | null> {
  const data = await redis.get(KEYS.notifications(userId, page));
  return data ? JSON.parse(data) : null;
}

export async function invalidateUserNotifications(userId: string): Promise<void> {
  // Invalidate first 5 pages
  const keys = Array.from({ length: 5 }, (_, i) => KEYS.notifications(userId, i));
  await redis.del(...keys);
  await redis.del(KEYS.unreadCount(userId));
}

// Unread Count Caching
export async function cacheUnreadCount(userId: string, count: number): Promise<void> {
  await redis.set(KEYS.unreadCount(userId), count.toString(), "EX", CACHE_TTL.UNREAD_COUNT);
}

export async function getCachedUnreadCount(userId: string): Promise<number | null> {
  const data = await redis.get(KEYS.unreadCount(userId));
  return data !== null ? parseInt(data, 10) : null;
}

// Notification Settings Caching
export async function cacheSettings(userId: string, settings: object): Promise<void> {
  await redis.set(KEYS.settings(userId), JSON.stringify(settings), "EX", CACHE_TTL.SETTINGS);
}

export async function getCachedSettings(userId: string): Promise<object | null> {
  const data = await redis.get(KEYS.settings(userId));
  return data ? JSON.parse(data) : null;
}

export async function invalidateSettings(userId: string): Promise<void> {
  await redis.del(KEYS.settings(userId));
}
