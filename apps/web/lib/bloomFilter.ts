// Bloom filter for username uniqueness check
// Uses Redis Bloom Filter (RedisBloom module) or falls back to SET
import { getRedis } from "./redis";

const BLOOM_KEY = "usernames:bloom";
const SET_KEY = "usernames:set";

// Check if RedisBloom is available
let useBloomFilter: boolean | null = null;

async function checkBloomAvailable(): Promise<boolean> {
  if (useBloomFilter !== null) return useBloomFilter;
  
  const redis = getRedis();
  try {
    // Try to use BF.EXISTS - will fail if RedisBloom not installed
    await redis.call("BF.EXISTS", BLOOM_KEY, "__test__");
    useBloomFilter = true;
  } catch {
    console.log("RedisBloom not available, falling back to SET");
    useBloomFilter = false;
  }
  return useBloomFilter;
}

/**
 * Check if username might exist (fast check)
 * Returns true if username MIGHT exist (check DB to confirm)
 * Returns false if username definitely does NOT exist
 */
export async function usernameExists(username: string): Promise<boolean> {
  const normalized = username.toLowerCase();
  const redis = getRedis();
  
  if (await checkBloomAvailable()) {
    // Use Bloom Filter (may have false positives, never false negatives)
    const result = await redis.call("BF.EXISTS", BLOOM_KEY, normalized);
    return result === 1;
  } else {
    // Fallback to Redis SET
    return (await redis.sismember(SET_KEY, normalized)) === 1;
  }
}

/**
 * Add username to bloom filter (call after successful registration)
 */
export async function addUsername(username: string): Promise<void> {
  const normalized = username.toLowerCase();
  const redis = getRedis();
  
  if (await checkBloomAvailable()) {
    await redis.call("BF.ADD", BLOOM_KEY, normalized);
  } else {
    await redis.sadd(SET_KEY, normalized);
  }
}

/**
 * Initialize bloom filter with existing usernames from database
 * Call this on app startup or via a migration
 */
export async function initBloomFilter(usernames: string[]): Promise<void> {
  const redis = getRedis();
  
  if (await checkBloomAvailable()) {
    // Create bloom filter with capacity for 1M usernames, 0.1% false positive rate
    try {
      await redis.call("BF.RESERVE", BLOOM_KEY, "0.001", "1000000");
    } catch {
      // Already exists, ignore
    }
    
    // Add existing usernames
    for (const username of usernames) {
      await redis.call("BF.ADD", BLOOM_KEY, username.toLowerCase());
    }
  } else {
    // Add to SET
    if (usernames.length > 0) {
      await redis.sadd(SET_KEY, ...usernames.map(u => u.toLowerCase()));
    }
  }
}
