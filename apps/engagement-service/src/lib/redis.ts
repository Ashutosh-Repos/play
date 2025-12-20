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

// Cache TTLs (in seconds)
const CACHE_TTL = {
  REACTION_COUNTS: 60 * 2,   // 2 minutes for reaction counts
  USER_REACTION: 60 * 5,     // 5 minutes for user's reaction on a video
  COMMENTS: 60 * 2,          // 2 minutes for comment lists
};

// Redis key prefixes
const KEYS = {
  reactionCounts: (videoId: string) => `engagement:reactions:${videoId}`,
  userReaction: (videoId: string, userId: string) => `engagement:reaction:${videoId}:${userId}`,
  comments: (videoId: string, page: number) => `engagement:comments:${videoId}:${page}`,
};

// Reaction Counts Caching
export interface ReactionCounts {
  likeCount: number;
  dislikeCount: number;
}

export async function cacheReactionCounts(videoId: string, counts: ReactionCounts): Promise<void> {
  await redis.set(KEYS.reactionCounts(videoId), JSON.stringify(counts), "EX", CACHE_TTL.REACTION_COUNTS);
}

export async function getCachedReactionCounts(videoId: string): Promise<ReactionCounts | null> {
  const data = await redis.get(KEYS.reactionCounts(videoId));
  return data ? JSON.parse(data) : null;
}

export async function invalidateReactionCounts(videoId: string): Promise<void> {
  await redis.del(KEYS.reactionCounts(videoId));
}

// User Reaction Caching (what reaction did user give)
export async function cacheUserReaction(videoId: string, userId: string, reaction: string | null): Promise<void> {
  await redis.set(KEYS.userReaction(videoId, userId), JSON.stringify({ reaction }), "EX", CACHE_TTL.USER_REACTION);
}

export async function getCachedUserReaction(videoId: string, userId: string): Promise<string | null | undefined> {
  const data = await redis.get(KEYS.userReaction(videoId, userId));
  if (!data) return undefined; // Cache miss
  const parsed = JSON.parse(data);
  return parsed.reaction;
}

export async function invalidateUserReaction(videoId: string, userId: string): Promise<void> {
  await redis.del(KEYS.userReaction(videoId, userId));
}

// Comments Caching
export async function cacheComments(videoId: string, page: number, comments: object[]): Promise<void> {
  await redis.set(KEYS.comments(videoId, page), JSON.stringify(comments), "EX", CACHE_TTL.COMMENTS);
}

export async function getCachedComments(videoId: string, page: number): Promise<object[] | null> {
  const data = await redis.get(KEYS.comments(videoId, page));
  return data ? JSON.parse(data) : null;
}

export async function invalidateVideoComments(videoId: string): Promise<void> {
  // Invalidate all pages (up to 10 cached pages)
  const keys = Array.from({ length: 10 }, (_, i) => KEYS.comments(videoId, i));
  await redis.del(...keys);
}

