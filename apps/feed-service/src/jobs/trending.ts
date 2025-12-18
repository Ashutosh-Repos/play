import { prisma } from "@repo/database/client";
import { redis } from "../lib/redis.js";

const TRENDING_KEY = "feed:trending";
const REFRESH_INTERVAL_MS = 1000 * 60 * 5; // 5 minutes

export async function refreshTrendingCache() {
  console.log("🔄 Refreshing Trending Cache...");
  try {
    // 1. Try Velocity-Based Ranking (Redis)
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    
    const kToday = `video:daily:${today}`;
    const kYesterday = `video:daily:${yesterday}`;
    const kDest = "feed:trending:calc"; // Temporary destination

    // Cleanup old calc
    await redis.del(kDest);

    // Union today (1.5x weight) and yesterday (1.0x weight)
    // Note: WEIGHTS is standard Redis command, ioredis supports it via `zunionstore`.
    // If keys don't exist, it treats as empty.
    const numKeys = await redis.zunionstore(kDest, 2, kToday, kYesterday, "WEIGHTS", 1.5, 1.0);

    let trendingIds: string[] = [];

    if (numKeys > 0) {
        trendingIds = await redis.zrevrange(kDest, 0, 49);
    }

    if (trendingIds.length < 10) {
        console.log("Not enough velocity data, falling back to All-Time Popular.");
        // Fallback: DB Query (Sort by ViewCount)
        const topVideos = await prisma.video.findMany({
            where: { 
                visibility: "PUBLIC",
                processingStatus: "READY"
            },
            orderBy: { viewCount: "desc" },
            take: 50,
            select: { id: true }
        });
        trendingIds = topVideos.map(v => v.id);
    }
    
    if (trendingIds.length === 0) return;

    // Pipeline Redis commands to update robust cache
    const pipeline = redis.pipeline();
    pipeline.del(TRENDING_KEY);

    // Add new (Score = 50 down to 1)
    trendingIds.forEach((id, index) => {
      const score = 50 - index;
      pipeline.zadd(TRENDING_KEY, score, id);
    });

    await pipeline.exec();
    console.log(`✅ Trending Cache updated with ${trendingIds.length} videos.`);
  } catch (error) {
    console.error("❌ Failed to refresh trending:", error);
  }
}

export function startTrendingJob() {
  refreshTrendingCache(); // Run immediately
  setInterval(refreshTrendingCache, REFRESH_INTERVAL_MS);
}
