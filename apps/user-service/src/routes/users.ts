// Users routes
import { Router } from "express";
import { prisma } from "@repo/database";
import { authMiddleware } from "@repo/common";
import { updateProfileSchema, updateNotificationSettingsSchema } from "../schemas.js";
import { emitUserUpdated } from "../events/publisher.js";

const router = Router();

// GET /users/me - Current user profile with channel
router.get("/me", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        role: true,
        status: true,
        createdAt: true,
        channel: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            bannerUrl: true,
            isVerified: true,
            subscriberCount: true,
            videoCount: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get user" },
    });
  }
});

// PATCH /users/me - Update profile
router.patch("/me", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;

    // Validate with Zod
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { displayName, bio, avatarUrl } = parsed.data;

    // Check if anything to update
    if (displayName === undefined && bio === undefined && avatarUrl === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "No fields to update" },
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
      },
    });

    // Emit event with only changed fields
    const changes: Record<string, unknown> = {};
    if (displayName !== undefined) changes.displayName = displayName;
    if (bio !== undefined) changes.bio = bio;
    if (avatarUrl !== undefined) changes.avatarUrl = avatarUrl;
    emitUserUpdated(userId, changes);

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Update me error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update user" },
    });
  }
});

// GET /users/username/:username - By username (MUST be before /:id)
router.get("/username/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username, deletedAt: null, status: "ACTIVE" },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        channel: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
            subscriberCount: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Get user by username error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get user" },
    });
  }
});

// GET /users/:id - Public profile (parameterized route AFTER specific routes)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null, status: "ACTIVE" },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        channel: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
            subscriberCount: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get user" },
    });
  }
});

export default router;

