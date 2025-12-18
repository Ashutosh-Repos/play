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

// Pending registration helpers
const PENDING_PREFIX = "pending:";
const PENDING_TTL = 60 * 60 * 24; // 24 hours

export interface PendingRegistration {
  email: string;
  passwordHash: string;
}

export async function setPendingRegistration(
  token: string,
  data: PendingRegistration
): Promise<void> {
  const redis = getRedis();
  await redis.setex(
    `${PENDING_PREFIX}${token}`,
    PENDING_TTL,
    JSON.stringify(data)
  );
}

export async function getPendingRegistration(
  token: string
): Promise<PendingRegistration | null> {
  const redis = getRedis();
  const data = await redis.get(`${PENDING_PREFIX}${token}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function deletePendingRegistration(token: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`${PENDING_PREFIX}${token}`);
}
