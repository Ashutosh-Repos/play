import { redis } from "../lib/redis.js";
import { prisma } from "@repo/database";
import { emitVideoStats } from "../events/publisher.js";

const VIEW_KEY_PREFIX = "video:views:";
const DIRTY_SET_KEY = "video:views:dirty_set";
const FLUSH_LOCK_KEY = "lock:flush_views";

// Buffer a view in Redis
export async function bufferView(videoId: string, ip: string, userId?: string) {
  // 1. Dedup (Simple approach: key by IP or User)
  const dedupKey = `view:dedup:${videoId}:${userId || ip}`;
  const exists = await redis.get(dedupKey);
  
  if (exists) {
    return false; // Already counted recently
  }

  // 2. Set Dedup Key (1 hour)
  await redis.set(dedupKey, "1", "EX", 3600);

  // 3. Increment Counter
  await redis.incr(`${VIEW_KEY_PREFIX}${videoId}`);

  // 3.1. Track Velocity (Daily ZSET)
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const dailyKey = `video:daily:${today}`;
  // ZINCRBY adds score. We use videoId as member, score as view count.
  // Expire after 3 days so we don't leak memory.
  const pipeline = redis.pipeline();
  pipeline.zincrby(dailyKey, 1, videoId);
  pipeline.expire(dailyKey, 60 * 60 * 24 * 3); // 3 Days
  await pipeline.exec();

  // 4. Mark as Dirty (so we know which video to update)
  await redis.sadd(DIRTY_SET_KEY, videoId);

  return true;
}

// Flush views from Redis to Postgres
export async function flushViewsToDB() {
  // 1. Acquire Lock (Simple SETNX)
  const locked = await redis.set(FLUSH_LOCK_KEY, "1", "EX", 10, "NX");
  if (!locked) {
    console.log("Flush job locked, skipping");
    return;
  }

  try {
    // 2. Get Dirty Videos
    const videoIds = await redis.smembers(DIRTY_SET_KEY);
    if (videoIds.length === 0) return;

    console.log(`Flushing views for ${videoIds.length} videos`);

    for (const videoId of videoIds) {
      // 3. Get and Delete Buffer count
      // We use GETSET 0 or GETDEL. GETDEL is available in Redis 6.2+. 
      // Safe approach: Multi/Exec to get and reset.
      
      const key = `${VIEW_KEY_PREFIX}${videoId}`;
      const countStr = await redis.get(key);
      const count = parseInt(countStr || "0", 10);

      if (count > 0) {
        // 4. Update Postgres FIRST
        const updatedVideo = await prisma.video.update({
          where: { id: videoId },
          data: {
            viewCount: { increment: count },
          },
        });

        // Emit updated stats for Search Service
        emitVideoStats(videoId, { viewCount: Number(updatedVideo.viewCount) });

        // 5. Decrement Redis AFTER success
        // If this fails, we effectively double-count next time (better than data loss)
        await redis.decrby(key, count);
      }
      
      // Remove from dirty set
      await redis.srem(DIRTY_SET_KEY, videoId);
    }
  } catch (error) {
    console.error("Error flushing views:", error);
  } finally {
    // Release Lock
    await redis.del(FLUSH_LOCK_KEY);
  }
}
