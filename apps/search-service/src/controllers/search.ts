import { Request, Response } from "express";
import { meili, INDEX_VIDEOS } from "../lib/meili.js";

// GET /search
export const searchVideos = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const sort = (req.query.sort as string) || "relevancy"; // relevancy, newest, popular

    const offset = (page - 1) * limit;

    const index = meili.index(INDEX_VIDEOS);

    let sortOption: string[] = [];
    if (sort === "newest") {
        sortOption = ["createdAt:desc"];
    } else if (sort === "popular") {
        sortOption = ["viewCount:desc"];
    }

    const result = await index.search(q, {
      limit,
      offset,
      sort: sortOption,
      filter: [
          "visibility = PUBLIC",
          "processingStatus = READY"
      ] // Always filter public
    });

    res.json({
        success: true,
        data: {
            hits: result.hits,
            estimatedTotalHits: result.estimatedTotalHits,
            processingTimeMs: result.processingTimeMs,
            page,
            totalPages: Math.ceil(result.estimatedTotalHits / limit)
        }
    });

  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({ error: "Search failed" });
  }
};
