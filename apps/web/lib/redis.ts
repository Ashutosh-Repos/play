// Redis client for bloom filter, pending registrations, and session cache
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Singleton Redis client
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      console.error("Redis connection error:", err);
    });

    redis.on("connect", () => {
      console.log("Redis connected");
    });
  }
  return redis;
}

// =============================================================================
// PENDING REGISTRATION - DEPRECATED / REMOVED
// We now use Postgres (EmailVerificationToken) for 2-step registration.
// Keeping Redis connection and other utils below.
// =============================================================================

// =============================================================================
// PASSWORD RESET (Redis-based)
// =============================================================================

const RESET_PREFIX = "reset:";
const RESET_TTL = 60 * 60; // 1 hour

export interface PasswordResetData {
  userId: string;
  email: string;
}

export async function setPasswordResetToken(
  token: string,
  data: PasswordResetData
): Promise<void> {
  const redis = getRedis();
  await redis.setex(`${RESET_PREFIX}${token}`, RESET_TTL, JSON.stringify(data));
}

export async function getPasswordResetToken(
  token: string
): Promise<PasswordResetData | null> {
  const redis = getRedis();
  const data = await redis.get(`${RESET_PREFIX}${token}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`${RESET_PREFIX}${token}`);
}

// =============================================================================
// RATE LIMITING (Sliding Window Counter)
// =============================================================================

const RATE_LIMIT_PREFIX = "ratelimit:";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp
}

/**
 * Check rate limit using sliding window counter algorithm
 * @param key - Unique identifier (e.g., "register:email@example.com" or "login:192.168.1.1")
 * @param limit - Max requests allowed in window
 * @param windowSeconds - Window size in seconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redis = getRedis();
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const redisKey = `${RATE_LIMIT_PREFIX}${key}`;

  // Use Lua script for atomic operation
  const luaScript = `
    -- Remove old entries outside the window
    redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
    
    -- Count current entries in window
    local count = redis.call('ZCARD', KEYS[1])
    
    -- Check if under limit
    if count < tonumber(ARGV[2]) then
      -- Add new entry with current timestamp as score
      redis.call('ZADD', KEYS[1], ARGV[3], ARGV[3])
      -- Set expiry on the sorted set
      redis.call('EXPIRE', KEYS[1], ARGV[4])
      return {1, tonumber(ARGV[2]) - count - 1}
    else
      return {0, 0}
    end
  `;

  const result = (await redis.eval(
    luaScript,
    1,
    redisKey,
    windowStart.toString(),
    limit.toString(),
    now.toString(),
    windowSeconds.toString()
  )) as [number, number];

  return {
    allowed: result[0] === 1,
    remaining: result[1],
    resetAt: Math.ceil((now + windowSeconds * 1000) / 1000),
  };
}

/**
 * Common rate limit configurations
 */
export const RATE_LIMITS = {
  // Registration: 3 attempts per email per hour
  register: { limit: 3, windowSeconds: 60 * 60 },
  // Login: 5 attempts per IP per 15 minutes
  login: { limit: 5, windowSeconds: 60 * 15 },
  // Password reset: 3 requests per email per hour
  passwordReset: { limit: 3, windowSeconds: 60 * 60 },
  // Email verification resend: 3 per hour
  resendVerification: { limit: 3, windowSeconds: 60 * 60 },
  // API general: 100 requests per minute
  api: { limit: 100, windowSeconds: 60 },
} as const;

