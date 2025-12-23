import { Request, Response } from "express";
import { prisma } from "@repo/database";
import { emitVideoLiked, emitVideoStats } from "../events/publisher.js";
import { z } from "zod";

// Schema for simple toggle
const ToggleSchema = z.object({
  type: z.enum(["LIKE", "DISLIKE"]),
});

export const toggleReaction = async (req: Request, res: Response) => {
  try {
    // User set by internalAuth middleware
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id: videoId } = req.params;
    if (!videoId) return res.status(400).json({ error: "Video ID required" });

    const { type } = ToggleSchema.parse(req.body);

    // Atomic Transaction to ensure consistency between VideoReaction and Video counts
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check existing reaction
      const existing = await tx.videoReaction.findUnique({
        where: { videoId_userId: { videoId, userId } },
      });

      if (existing) {
        if (existing.type === type) {
          // Case A: Toggle OFF (Remove reaction)
          await tx.videoReaction.delete({
            where: { id: existing.id },
          });

          // Decrement count on Video
          const updatedVideo = await tx.video.update({
            where: { id: videoId },
            data: {
              ...(type === "LIKE" ? { likeCount: { decrement: 1 } } : { dislikeCount: { decrement: 1 } })
            },
            select: { likeCount: true, dislikeCount: true }
          });
          
          return { status: "removed", reaction: null, likeCount: updatedVideo.likeCount, dislikeCount: updatedVideo.dislikeCount };

        } else {
          // Case B: Switch Type (Like -> Dislike or vice versa)
          await tx.videoReaction.update({
            where: { id: existing.id },
            data: { type },
          });

          // Decrement old, Increment new
          const updatedVideo = await tx.video.update({
            where: { id: videoId },
            data: {
              ...(existing.type === "LIKE" ? { likeCount: { decrement: 1 } } : { dislikeCount: { decrement: 1 } }),
              ...(type === "LIKE" ? { likeCount: { increment: 1 } } : { dislikeCount: { increment: 1 } })
            },
            select: { likeCount: true, dislikeCount: true }
          });
          
          return { status: "updated", reaction: type, likeCount: updatedVideo.likeCount, dislikeCount: updatedVideo.dislikeCount };
        }
      } else {
        // Case C: Create New
        await tx.videoReaction.create({
          data: {
            videoId,
            userId,
            type,
          },
        });
        
        // Increment count
        const updatedVideo = await tx.video.update({
          where: { id: videoId },
          data: {
            ...(type === "LIKE" ? { likeCount: { increment: 1 } } : { dislikeCount: { increment: 1 } })
          },
          select: { likeCount: true, dislikeCount: true }
        });

        return { status: "created", reaction: type, likeCount: updatedVideo.likeCount, dislikeCount: updatedVideo.dislikeCount };
      }
    });

    // Emit events
    if (result.reaction) {
        emitVideoLiked(videoId, userId, result.reaction);
    }
    
    // Emit stats for Search Service
    emitVideoStats(videoId, { 
      likeCount: Number(result.likeCount), 
      dislikeCount: Number(result.dislikeCount) 
    });

    return res.json({ 
        success: true, 
        data: { 
            status: result.status, 
            reaction: result.reaction,
            likeCount: result.likeCount, 
            dislikeCount: result.dislikeCount 
        } 
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
        // Race condition: Record created by another request in parallel
        return res.status(409).json({ error: { code: "CONFLICT", message: "Conflict: Reaction already processed, please retry" } });
    }
    console.error("Reaction Error:", error);
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal Server Error" } });
  }
};

export const getReaction = async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    const { id: videoId } = req.params;
    
    if (!userId) return res.json({ success: true, data: { type: null } });
    if (!videoId) return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Video ID required" } });

    const reaction = await prisma.videoReaction.findUnique({
        where: { videoId_userId: { videoId, userId } },
        select: { type: true }
    });

    return res.json({ success: true, data: { reaction: reaction?.type || null } });
}
