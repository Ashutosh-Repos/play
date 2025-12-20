import { Request, Response } from "express";
import { prisma } from "@repo/database";
import { z } from "zod";
import { sanitize } from "@repo/common";

// Sanitization logic moved to @repo/common

const CreateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().optional(),
});

// Helper: Check if user is the owner of the video the comment is on
async function isVideoOwner(userId: string, videoId: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { channel: true }
  });
  return video?.channel?.userId === userId;
}

// POST /videos/:id/comments
export const createComment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id: videoId } = req.params;
    if (!videoId) return res.status(400).json({ error: "Video ID required" });
    const { content, parentId } = CreateCommentSchema.parse(req.body);

    // Sanitize comment content to prevent XSS
    const sanitizedContent = sanitize(content);
    if (!sanitizedContent) {
      return res.status(400).json({ error: "Comment content cannot be empty after sanitization" });
    }

    // If reply, Verify parent exists and belongs to same video
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parent || parent.videoId !== videoId) {
        return res.status(400).json({ error: "Invalid parent comment" });
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content: sanitizedContent, // Use sanitized content
        videoId,
        userId,
        parentId,
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } }
      }
    });

    // Increment comment count on Video
    // TODO: Move to event consumer for scalability, but fine for now
    await prisma.video.update({
      where: { id: videoId },
      data: { commentCount: { increment: 1 } }
    });
    
    // Increment reply count on parent if reply
    if (parentId) {
        await prisma.comment.update({
            where: { id: parentId },
            data: { replyCount: { increment: 1 } }
        });
    }

    res.status(201).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error("Create Comment Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// GET /videos/:id/comments
export const listComments = async (req: Request, res: Response) => {
  try {
    const { id: videoId } = req.params;
    const { page = "1", limit = "20" } = req.query; // Default 20
    const skip = (Number(page) - 1) * Number(limit);

    const comments = await prisma.comment.findMany({
      where: { 
        videoId, 
        parentId: null, 
        // Show VISIBLE, or REMOVED (if we want tombstones). 
        // For simplicity: Show REMOVED if they have replies (handled by frontend usually).
        // Actually, easiest is to filter out pure deleted ones, but keep structured ones.
        // Let's rely on status != REMOVED for now, but if the user wants "YouTube like",
        // we should actually include them if replyCount > 0.
        OR: [
            { status: "VISIBLE" },
            { status: "REMOVED", replyCount: { gt: 0 } }
        ]
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { replies: true } } 
      },
      orderBy: [
        { isPinned: "desc" },   // Pinned first
        { createdAt: "desc" }   // Then newest
      ],
      take: Number(limit),
      skip,
    });

    // Sanitize tombstones
    const sanitized = comments.map((c: typeof comments[0]) => {
        if (c.status === "REMOVED") {
            return {
                ...c,
                content: "[Comment Deleted]",
                user: null, // Hide user info
                isPinned: false
            };
        }
        return c;
    });

    res.json(sanitized);
  } catch (error) {
    console.error("List Comments Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// GET /comments/:id/replies
export const listReplies = async (req: Request, res: Response) => {
    try {
        const { id: commentId } = req.params;
        const { page = "1", limit = "10" } = req.query;
        
        const replies = await prisma.comment.findMany({
            where: { 
                parentId: commentId,
                OR: [
                    { status: "VISIBLE" },
                    { status: "REMOVED", replyCount: { gt: 0 } }
                ]
            },
            include: {
                user: { select: { id: true, username: true, avatarUrl: true } }
            },
            orderBy: { createdAt: "asc" }, // Oldest first for replies usually
            take: Number(limit),
            skip: (Number(page) - 1) * Number(limit),
        });

        const sanitized = replies.map((c: typeof replies[0]) => {
            if (c.status === "REMOVED") {
                return {
                    ...c,
                    content: "[Comment Deleted]",
                    user: null, 
                    isPinned: false
                };
            }
            return c;
        });

        res.json(sanitized);
    } catch (error) {
        console.error("List Replies Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

// DELETE /comments/:id
export const deleteComment = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.sub;
        const { id: commentId } = req.params;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const comment = await prisma.comment.findUnique({ where: { id: commentId } });
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        // Allowed if: User is Author OR User is Video Owner
        const isAuthor = comment.userId === userId;
        const isOwner = await isVideoOwner(userId, comment.videoId);

        if (!isAuthor && !isOwner) {
            return res.status(403).json({ error: "Forbidden" });
        }

        if (comment.status === "REMOVED") {
            return res.json({ success: true, message: "Already deleted" });
        }

        // Soft Delete
        await prisma.comment.update({
            where: { id: commentId },
            data: { 
                status: "REMOVED",
                deletedAt: new Date()
            }
        });

        // Decrement counts safely
        await prisma.video.update({
            where: { id: comment.videoId },
            data: { commentCount: { decrement: 1 } }
        });
        
        if (comment.parentId) {
            await prisma.comment.update({
                where: { id: comment.parentId },
                data: { replyCount: { decrement: 1 } }
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error("Delete Comment Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

// POST /comments/:id/pin (Toggle)
export const pinComment = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.sub;
        const { id: commentId } = req.params;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const comment = await prisma.comment.findUnique({ where: { id: commentId } });
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        // Only Video Owner can pin
        if (!await isVideoOwner(userId, comment.videoId)) {
            return res.status(403).json({ error: "Only the video owner can pin comments" });
        }

        // Transaction: Unpin all others in this video, Pin this one
        await prisma.$transaction([
            prisma.comment.updateMany({
                where: { videoId: comment.videoId, isPinned: true },
                data: { isPinned: false }
            }),
            prisma.comment.update({
                where: { id: commentId },
                data: { isPinned: true }
            })
        ]);

        res.json({ success: true, isPinned: true });
    } catch (error) {
        console.error("Pin Comment Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

// POST /comments/:id/unpin
export const unpinComment = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.sub;
        const { id: commentId } = req.params;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const comment = await prisma.comment.findUnique({ where: { id: commentId } });
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        if (!await isVideoOwner(userId, comment.videoId)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        await prisma.comment.update({
            where: { id: commentId },
            data: { isPinned: false }
        });

        res.json({ success: true, isPinned: false });
    } catch (error) {
        console.error("Unpin Comment Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

// POST /comments/:id/heart
export const heartComment = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.sub;
        const { id: commentId } = req.params;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const comment = await prisma.comment.findUnique({ where: { id: commentId } });
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        // Only Video Owner can heart
        if (!await isVideoOwner(userId, comment.videoId)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const updated = await prisma.comment.update({
            where: { id: commentId },
            data: { isHearted: !comment.isHearted } // Toggle
        });

        res.json({ success: true, isHearted: updated.isHearted });
    } catch (error) {
        console.error("Heart Comment Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}
