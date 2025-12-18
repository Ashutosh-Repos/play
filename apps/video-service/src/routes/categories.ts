// Category routes - list and get categories
import { Router } from "express";
import { prisma } from "@repo/database";

const router = Router();

// GET /categories - List all categories
router.get("/", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        iconUrl: true,
        sortOrder: true,
      },
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get categories" },
    });
  }
});

// GET /categories/:slug - Get category by slug with video count
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const category = await prisma.category.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        iconUrl: true,
        _count: {
          select: {
            videos: {
              where: { visibility: "PUBLIC", deletedAt: null },
            },
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Category not found" },
      });
    }

    res.json({
      success: true,
      data: {
        ...category,
        videoCount: category._count.videos,
        _count: undefined,
      },
    });
  } catch (error) {
    console.error("Get category error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get category" },
    });
  }
});

// GET /categories/:slug/videos - Get videos in category
router.get("/:slug/videos", async (req, res) => {
  try {
    const { slug } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const cursor = req.query.cursor as string | undefined;
    const sort = (req.query.sort as string) || "hot";

    // Get category
    const category = await prisma.category.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Category not found" },
      });
    }

    // Determine sort order
    const orderBy = 
      sort === "latest" ? { publishedAt: "desc" as const } :
      sort === "views" ? { viewCount: "desc" as const } :
      { hotScore: "desc" as const };

    const videos = await prisma.video.findMany({
      where: {
        categoryId: category.id,
        visibility: "PUBLIC",
        processingStatus: "READY",
        deletedAt: null,
      },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy,
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        duration: true,
        viewCount: true,
        publishedAt: true,
        channelName: true,
        channelHandle: true,
        channelAvatarUrl: true,
      },
    });

    const hasMore = videos.length > limit;
    const items = hasMore ? videos.slice(0, -1) : videos;

    res.json({
      success: true,
      data: {
        category: { id: category.id, name: category.name },
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : null,
      },
    });
  } catch (error) {
    console.error("Get category videos error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get videos" },
    });
  }
});

export default router;
