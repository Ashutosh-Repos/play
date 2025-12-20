// Redis client for search-service caching
import { Redis } from "ioredis";
import { serverEnv } from "@repo/config";

export const redis = new Redis(serverEnv.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("error", (err: Error) => console.error("Redis Client Error:", err));
redis.on("connect", () => console.log("✅ Redis Connected (Search Service)"));

// Cache TTLs (in seconds)
const CACHE_TTL = {
  SEARCH_RESULTS: 60 * 5,     // 5 minutes for search results
  SUGGESTIONS: 60 * 10,       // 10 minutes for search suggestions
  POPULAR_SEARCHES: 60 * 15,  // 15 minutes for popular searches
};

// Redis key prefixes
const KEYS = {
  searchResults: (query: string, page: number) => `search:results:${query.toLowerCase()}:${page}`,
  suggestions: (prefix: string) => `search:suggest:${prefix.toLowerCase()}`,
  popularSearches: () => `search:popular`,
};

// Search Results Caching
export async function cacheSearchResults(query: string, page: number, results: object): Promise<void> {
  await redis.set(KEYS.searchResults(query, page), JSON.stringify(results), "EX", CACHE_TTL.SEARCH_RESULTS);
}

export async function getCachedSearchResults(query: string, page: number): Promise<object | null> {
  const data = await redis.get(KEYS.searchResults(query, page));
  return data ? JSON.parse(data) : null;
}

// Search Suggestions Caching
export async function cacheSuggestions(prefix: string, suggestions: string[]): Promise<void> {
  await redis.set(KEYS.suggestions(prefix), JSON.stringify(suggestions), "EX", CACHE_TTL.SUGGESTIONS);
}

export async function getCachedSuggestions(prefix: string): Promise<string[] | null> {
  const data = await redis.get(KEYS.suggestions(prefix));
  return data ? JSON.parse(data) : null;
}

// Popular Searches Caching
export async function cachePopularSearches(searches: string[]): Promise<void> {
  await redis.set(KEYS.popularSearches(), JSON.stringify(searches), "EX", CACHE_TTL.POPULAR_SEARCHES);
}

export async function getCachedPopularSearches(): Promise<string[] | null> {
  const data = await redis.get(KEYS.popularSearches());
  return data ? JSON.parse(data) : null;
}

// Track search query (for popular searches)
export async function trackSearchQuery(query: string): Promise<void> {
  const key = "search:query_counts";
  await redis.zincrby(key, 1, query.toLowerCase());
  await redis.expire(key, 60 * 60 * 24); // Expire in 24h
}

// Get top searched queries
export async function getTopSearchQueries(limit: number = 10): Promise<string[]> {
  const results = await redis.zrevrange("search:query_counts", 0, limit - 1);
  return results;
}
