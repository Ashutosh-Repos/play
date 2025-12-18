import { Request, Response } from "express";
import { prisma } from "@repo/database/client";
import { redis } from "../lib/redis.js";

const TRENDING_KEY = "feed:trending";

// Helper for pagination
const getPagination = (req: Request) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = req.query.cursor as string | undefined;
    return { limit, cursor };
};

// Get Global Trending Videos
export const getTrendingFeed = async (req: Request, res: Response) => {
    const { limit, cursor } = getPagination(req);
    // Cursor for Redis ZSET is index-based (offset) logic usually, or Score based?
    // Using simple offset (page * limit) is easier for Redis but less consistent.
    // For ZSET, we can use ZREVRANGE start stop.
    // If "cursor" is an integer index:
    const start = cursor ? Number(cursor) : 0;
    const end = start + limit - 1;

    try {
        // 1. Try Redis cache
        const cachedIds = await redis.zrevrange(TRENDING_KEY, start, end);
        
        let videos: any[] = [];
        if (cachedIds.length > 0) {
            const unordered = await prisma.video.findMany({
                where: { id: { in: cachedIds }, visibility: "PUBLIC" },
                include: { channel: true }
            });
            const map = new Map(unordered.map(v => [v.id, v]));
            videos = cachedIds.map(id => map.get(id)).filter((v): v is typeof unordered[0] => !!v);
        } else if (start === 0) {
             // Fallback only if first page
            videos = await prisma.video.findMany({
                where: { visibility: "PUBLIC" },
                orderBy: { viewCount: "desc" },
                take: limit,
                include: { channel: true }
            });
        } else {
            videos = [];
        }
        
        const nextCursor = videos && videos.length === limit ? start + limit : null;
        res.json({ videos, nextCursor });
    } catch (error) {
        console.error("Trending Error", error);
        res.status(500).json({ error: "Internal Error" });
    }
};

// Get User Subscriptions Feed
export const getSubscriptionFeed = async (req: Request, res: Response) => {
    const userId = req.headers["x-user-id"] as string;
    const { limit, cursor } = getPagination(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
        const subscriptions = await prisma.subscription.findMany({
            where: { subscriberId: userId },
            select: { channelId: true }
        });

        const channelIds = subscriptions.map(s => s.channelId);

        if (channelIds.length === 0) {
            return res.json({ videos: [], nextCursor: null });
        }

        const videos = await prisma.video.findMany({
            where: { 
                channelId: { in: channelIds },
                visibility: "PUBLIC"
            },
            orderBy: { createdAt: "desc" },
            take: limit + 1, // Fetch 1 extra to check next
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0, // Skip cursor itself
            include: { channel: true }
        });

        let nextCursor = null;
        if (videos.length > limit) {
            const nextItem = videos.pop();
            nextCursor = nextItem?.id;
        }

        res.json({ videos, nextCursor });
    } catch (error) {
         console.error("Subs Feed Error", error);
         res.status(500).json({ error: "Internal Error" });
    }
};

// Get User Watch History
export const getHistoryFeed = async (req: Request, res: Response) => {
    const userId = req.headers["x-user-id"] as string;
    const { limit, cursor } = getPagination(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
        const history = await prisma.watchHistory.findMany({
            where: { userId },
            orderBy: { lastWatchedAt: "desc" },
            take: limit + 1,
            cursor: cursor ? { id: cursor } // WatchHistory ID used as cursor
            // Wait, WatchHistory ID? Only if we select it?
            // Schema: @@unique([userId, videoId]), id is default(cuid()).
            // Paginating by ID when ordering by lastWatchedAt is tricky if using ID as cursor but ID is not sort key.
            // Prisma supports cursor based on unique constraints. ID is primary key.
            // But if we order by lastWatchedAt, we need a stable cursor.
            // Using ID is fine if we stick to ID as cursor for fetching, but sorting?
            // "Cursor must be unique and point to an existing record".
            // Correct way: use ID as cursor, and KEEP the sort order.
            : undefined, 
            skip: cursor ? 1 : 0,
            include: { 
                video: {
                    include: { channel: true }
                }
            }
        });

        let nextCursor = null;
        if (history.length > limit) {
            const nextItem = history.pop();
            nextCursor = nextItem?.id;
        }

        // Flatten structure
        const videos = history.map(h => ({
            ...h.video,
            watchedAt: h.lastWatchedAt,
            watchCount: h.watchCount
        }));

        res.json({ videos, nextCursor });
    } catch (error) {
         console.error("History Feed Error", error);
         res.status(500).json({ error: "Internal Error" });
    }
};

// Home Feed (Personalized)
// MVP: Just Trending for now
export const getHomeFeed = getTrendingFeed;
