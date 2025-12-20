import Redis from "ioredis";
import { serverEnv } from "@repo/config";

export const redis = new Redis(serverEnv.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("error", (err: Error) => console.error("Redis Client Error:", err));
redis.on("connect", () => console.log("✅ Redis Connected (Feed Service)"));

// Cache TTLs (in seconds)
const CACHE_TTL = {
  TRENDING: 60 * 5,        // 5 minutes for trending
  HOME_FEED: 60 * 2,       // 2 minutes for home feed
  SUBSCRIPTION_FEED: 60,   // 1 minute for subscription feed
  HISTORY: 60 * 5,         // 5 minutes for watch history
};

// Redis key prefixes
const KEYS = {
  trending: (region?: string) => `feed:trending:${region || 'global'}`,
  homeFeed: (cursor?: string) => `feed:home:${cursor || 'first'}`,
  subFeed: (userId: string, cursor?: string) => `feed:sub:${userId}:${cursor || 'first'}`,
  history: (userId: string, page: number) => `feed:history:${userId}:${page}`,
};

// Trending Feed Cache
export async function cacheTrending(videos: object[], region?: string): Promise<void> {
  await redis.set(KEYS.trending(region), JSON.stringify(videos), "EX", CACHE_TTL.TRENDING);
}

export async function getCachedTrending(region?: string): Promise<object[] | null> {
  const data = await redis.get(KEYS.trending(region));
  return data ? JSON.parse(data) : null;
}

// Home Feed Cache
export async function cacheHomeFeed(videos: object[], cursor?: string): Promise<void> {
  await redis.set(KEYS.homeFeed(cursor), JSON.stringify(videos), "EX", CACHE_TTL.HOME_FEED);
}

export async function getCachedHomeFeed(cursor?: string): Promise<object[] | null> {
  const data = await redis.get(KEYS.homeFeed(cursor));
  return data ? JSON.parse(data) : null;
}

// Subscription Feed Cache (per user)
export async function cacheSubscriptionFeed(userId: string, videos: object[], cursor?: string): Promise<void> {
  await redis.set(KEYS.subFeed(userId, cursor), JSON.stringify(videos), "EX", CACHE_TTL.SUBSCRIPTION_FEED);
}

export async function getCachedSubscriptionFeed(userId: string, cursor?: string): Promise<object[] | null> {
  const data = await redis.get(KEYS.subFeed(userId, cursor));
  return data ? JSON.parse(data) : null;
}

// History Cache
export async function cacheHistory(userId: string, page: number, history: object[]): Promise<void> {
  await redis.set(KEYS.history(userId, page), JSON.stringify(history), "EX", CACHE_TTL.HISTORY);
}

export async function getCachedHistory(userId: string, page: number): Promise<object[] | null> {
  const data = await redis.get(KEYS.history(userId, page));
  return data ? JSON.parse(data) : null;
}

export async function invalidateUserHistory(userId: string): Promise<void> {
  // Invalidate first 5 pages of history cache
  const keys = Array.from({ length: 5 }, (_, i) => KEYS.history(userId, i));
  await redis.del(...keys);
}

