import { Request, Response } from "express";
import { prisma } from "@repo/database";
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
                where: { id: { in: cachedIds }, visibility: "PUBLIC", processingStatus: "READY" },
                include: { channel: true }
            });
            const map = new Map(unordered.map((v: typeof unordered[0]) => [v.id, v]));
            videos = cachedIds.map(id => map.get(id)).filter((v): v is typeof unordered[0] => !!v);
        } else if (start === 0) {
             // Fallback only if first page
            videos = await prisma.video.findMany({
                where: { visibility: "PUBLIC", processingStatus: "READY" },
                orderBy: { viewCount: "desc" },
                take: limit,
                include: { channel: true }
            });
        } else {
            videos = [];
        }
        
        // Transform to match client expectations
        const transformedVideos = videos.map(v => ({
            id: v.id,
            title: v.title,
            thumbnailUrl: v.thumbnailUrl,
            viewCount: Number(v.viewCount),
            publishedAt: v.publishedAt?.toISOString() || v.createdAt.toISOString(),
            createdAt: v.createdAt.toISOString(),
            duration: v.duration,
            channelName: v.channel.displayName,
            channelHandle: v.channel.handle,
            channelAvatarUrl: v.channel.avatarUrl,
            likeCount: v.likeCount,
            commentCount: v.commentCount
        }));
        
        const nextCursor = transformedVideos && transformedVideos.length === limit ? start + limit : null;
        res.json({ success: true, data: { videos: transformedVideos, nextCursor } });
    } catch (error) {
        console.error("Trending Error", error);
        res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Internal Error" } });
    }
};

// Get User Subscriptions Feed
export const getSubscriptionFeed = async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    const { limit, cursor } = getPagination(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
        // Fetch a reasonable max number of subscriptions (prevent loading 10k+ channel IDs into memory)
        // Users with more than 500 subscriptions will only see videos from their first 500
        // This acts as a hard cap to prevent OOM until cursor-based subscription fetching is implemented.
        const MAX_SUBSCRIPTIONS = 500;
        
        const subscriptions = await prisma.subscription.findMany({
            where: { subscriberId: userId },
            select: { channelId: true },
            take: MAX_SUBSCRIPTIONS,
            orderBy: { subscribedAt: "desc" } // Most recent subscriptions first
        });

        const channelIds = subscriptions.map((s: { channelId: string }) => s.channelId);

        if (channelIds.length === 0) {
            return res.json({ success: true, data: { videos: [], nextCursor: null } });
        }

        const videos = await prisma.video.findMany({
            where: { 
                channelId: { in: channelIds },
                visibility: "PUBLIC",
                processingStatus: "READY"
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

        // Transform to match client expectations
        const transformedVideos = videos.map(v => ({
            id: v.id,
            title: v.title,
            thumbnailUrl: v.thumbnailUrl,
            viewCount: Number(v.viewCount),
            publishedAt: v.publishedAt?.toISOString() || v.createdAt.toISOString(),
            createdAt: v.createdAt.toISOString(),
            duration: v.duration,
            channelName: v.channel.displayName,
            channelHandle: v.channel.handle,
            channelAvatarUrl: v.channel.avatarUrl,
            likeCount: v.likeCount,
            commentCount: v.commentCount
        }));

        res.json({ success: true, data: { videos: transformedVideos, nextCursor } });
    } catch (error) {
         console.error("Subs Feed Error", error);
         res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Internal Error" } });
    }
};

// Get User Watch History
export const getHistoryFeed = async (req: Request, res: Response) => {
    const userId = req.user?.sub;
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

        // Flatten structure and transform
        const transformedVideos = history.map((h: typeof history[0]) => ({
            id: h.video.id,
            title: h.video.title,
            thumbnailUrl: h.video.thumbnailUrl,
            viewCount: Number(h.video.viewCount),
            publishedAt: h.video.publishedAt?.toISOString() || h.video.createdAt.toISOString(),
            createdAt: h.video.createdAt.toISOString(),
            duration: h.video.duration,
            channelName: h.video.channel.displayName,
            channelHandle: h.video.channel.handle,
            channelAvatarUrl: h.video.channel.avatarUrl,
            likeCount: h.video.likeCount,
            commentCount: h.video.commentCount,
            watchedAt: h.lastWatchedAt.toISOString(),
            watchCount: h.watchCount
        }));

        res.json({ success: true, data: { videos: transformedVideos, nextCursor } });
    } catch (error) {
         console.error("History Feed Error", error);
         res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Internal Error" } });
    }
};

// Home Feed (Personalized)
// MVP: Just Trending for now
export const getHomeFeed = getTrendingFeed;
