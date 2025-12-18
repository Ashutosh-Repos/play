import { Request, Response } from "express";
import { prisma } from "@repo/database";
import { emitVideoLiked } from "../events/publisher.js";
import { z } from "zod";

// Schema for simple toggle
const ToggleSchema = z.object({
  type: z.enum(["LIKE", "DISLIKE"]),
});

export const toggleReaction = async (req: Request, res: Response) => {
  try {
    // Auth check should be middleware (assuming req.user populated)
    const userId = req.headers["x-user-id"] as string; 
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id: videoId } = req.params;
    if (!videoId) return res.status(400).json({ error: "Video ID required" });

    const { type } = ToggleSchema.parse(req.body);

    // Atomic Upsert/Delete logic
    // 1. Check existing reaction
    const existing = await prisma.videoReaction.findUnique({
      where: { videoId_userId: { videoId, userId } },
    });

    if (existing) {
      if (existing.type === type) {
        // Toggle OFF (Remove reaction)
        await prisma.videoReaction.delete({
          where: { id: existing.id },
        });
        // We might want to emit 'video.unliked' or just generic 'video.reaction.updated'
        // For now, let's keep it simple.
        
        return res.json({ status: "removed", type: null });
      } else {
        // Change Type (Like -> Dislike or vice versa)
        await prisma.videoReaction.update({
          where: { id: existing.id },
          data: { type },
        });
        
        emitVideoLiked(videoId, userId, type); // Emit new state
        return res.json({ status: "updated", type });
      }
    } else {
      // Create New
      await prisma.videoReaction.create({
        data: {
          videoId,
          userId,
          type,
        },
      });
      
      emitVideoLiked(videoId, userId, type);
      return res.json({ status: "created", type });
    }
  } catch (error: any) {
    if (error.code === 'P2002') {
        // Race condition: Record created by another request in parallel
        return res.status(409).json({ error: "Conflict: Reaction already processed, please retry" });
    }
    console.error("Reaction Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getReaction = async (req: Request, res: Response) => {
    const userId = req.headers["x-user-id"] as string;
    const { id: videoId } = req.params;
    
    if (!userId) return res.json({ type: null });
    if (!videoId) return res.status(400).json({ error: "Video ID required" });

    const reaction = await prisma.videoReaction.findUnique({
        where: { videoId_userId: { videoId, userId } },
        select: { type: true }
    });

    return res.json({ type: reaction?.type || null });
}
