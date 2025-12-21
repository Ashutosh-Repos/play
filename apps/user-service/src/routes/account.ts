// Account routes - sessions, connections, deletion
import { Router } from "express";
import { prisma } from "@repo/database";
import { authMiddleware } from "@repo/common";
import bcrypt from "bcrypt";
import { emitUserDeleted, emitUserRestored } from "../events/publisher.js";

const router = Router();

// GET /account/sessions - List active sessions
router.get("/sessions", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const currentTokenId = req.headers["x-token-id"] as string | undefined;

    const sessions = await prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Mark current session
    const sessionsWithCurrent = sessions.map((s: typeof sessions[0]) => ({
      ...s,
      current: s.id === currentTokenId,
    }));

    res.json({ success: true, data: sessionsWithCurrent });
  } catch (error) {
    console.error("Get sessions error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get sessions" },
    });
  }
});

// DELETE /account/sessions/others - Revoke all except current (MUST be before /:id)
router.delete("/sessions/others", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const currentTokenId = req.headers["x-token-id"] as string | undefined;

    if (!currentTokenId) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_TOKEN_ID", message: "x-token-id header required" },
      });
    }

    const result = await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        id: { not: currentTokenId },
      },
      data: { revokedAt: new Date() },
    });

    res.json({
      success: true,
      data: { message: `${result.count} sessions revoked` },
    });
  } catch (error) {
    console.error("Revoke others error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to revoke sessions" },
    });
  }
});

// DELETE /account/sessions/:id - Revoke a session
router.delete("/sessions/:id", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;

    const token = await prisma.refreshToken.findFirst({
      where: { id, userId, revokedAt: null },
    });

    if (!token) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Session not found" },
      });
    }

    await prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    res.json({ success: true, data: { message: "Session revoked" } });
  } catch (error) {
    console.error("Revoke session error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to revoke session" },
    });
  }
});

// GET /account/connections - List OAuth connections
router.get("/connections", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;

    const connections = await prisma.oAuthIdentity.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: connections });
  } catch (error) {
    console.error("Get connections error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get connections" },
    });
  }
});

// DELETE /account/connections/:provider - Unlink OAuth provider
router.delete("/connections/:provider", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { provider } = req.params;

    // Validate provider exists
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_PROVIDER", message: "Provider is required" },
      });
    }

    // Validate provider name
    const validProviders = ["google", "github", "discord"];
    if (!validProviders.includes(provider.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_PROVIDER", message: `Invalid provider. Must be one of: ${validProviders.join(", ")}` },
      });
    }

    // Get user and connections
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { identities: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    // Prevent unlinking if no password and only one connection
    if (!user.passwordHash && user.identities.length <= 1) {
      return res.status(400).json({
        success: false,
        error: { code: "LAST_AUTH", message: "Cannot remove last login method. Set a password first." },
      });
    }

    const connection = user.identities.find((i: typeof user.identities[0]) => i.provider.toLowerCase() === provider.toLowerCase());
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Connection not found" },
      });
    }

    await prisma.oAuthIdentity.delete({ where: { id: connection.id } });

    res.json({ success: true, data: { message: "Connection removed" } });
  } catch (error) {
    console.error("Unlink connection error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to unlink connection" },
    });
  }
});

// POST /account/restore - Cancel account deletion (within grace period)
router.post("/restore", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    if (!user.deletedAt) {
      return res.status(400).json({
        success: false,
        error: { code: "NOT_DELETED", message: "Account is not scheduled for deletion" },
      });
    }

    // Check grace period (30 days)
    const gracePeriod = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - user.deletedAt.getTime() > gracePeriod) {
      return res.status(400).json({
        success: false,
        error: { code: "GRACE_EXPIRED", message: "Grace period has expired" },
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    });

    // Emit event
    emitUserRestored(userId);

    res.json({ success: true, data: { message: "Account restored" } });
  } catch (error) {
    console.error("Restore account error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to restore account" },
    });
  }
});

// DELETE /account - Request account deletion
router.delete("/", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    if (user.deletedAt) {
      return res.status(400).json({
        success: false,
        error: { code: "ALREADY_DELETED", message: "Account already scheduled for deletion" },
      });
    }

    // Require password if user has one
    if (user.passwordHash) {
      if (!password) {
        return res.status(400).json({
          success: false,
          error: { code: "PASSWORD_REQUIRED", message: "Password required to delete account" },
        });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({
          success: false,
          error: { code: "INVALID_PASSWORD", message: "Incorrect password" },
        });
      }
    } else {
      // For OAuth users (no password), require recent login (re-authentication)
      // Check 'iat' (issued at) claim in JWT
      const tokenIat = (req.user as any).iat; // Assuming 'iat' is available in decoded token
      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;

      if (!tokenIat || tokenIat < fiveMinutesAgo) {
         return res.status(401).json({
          success: false,
          error: { 
            code: "REAUTHENTICATION_REQUIRED", 
            message: "For security, please sign out and sign in again before deleting your account." 
          },
        });
      }
    }

    // Soft delete - set deletedAt
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    // Revoke all sessions
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    // Emit event
    emitUserDeleted(userId);

    res.json({
      success: true,
      data: { message: "Account scheduled for deletion. You have 30 days to cancel via /account/restore." },
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to delete account" },
    });
  }
});

// POST /account/password - Set password (for OAuth users who don't have one)
router.post("/password", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Password must be at least 8 characters" },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    // Only allow setting if no password exists
    if (user.passwordHash) {
      return res.status(400).json({
        success: false,
        error: { code: "PASSWORD_EXISTS", message: "Password already set. Use PATCH to change it." },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({ success: true, data: { message: "Password set successfully" } });
  } catch (error) {
    console.error("Set password error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to set password" },
    });
  }
});

// PATCH /account/password - Change password (must know current password)
router.patch("/password", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Current and new password required" },
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "New password must be at least 8 characters" },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      return res.status(400).json({
        success: false,
        error: { code: "NO_PASSWORD", message: "No password set. Use POST to set initial password." },
      });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_PASSWORD", message: "Current password is incorrect" },
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({ success: true, data: { message: "Password changed successfully" } });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to change password" },
    });
  }
});

// Email change routes removed due to security vulnerability (no storage of pending email)
// TODO: Re-implement with secure PendingEmailChange model


// PATCH /account/username - Change username (rate limited - max 1 change per 30 days)
router.patch("/username", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { username } = req.body;

    // Validate username format
    if (!username || username.length < 3 || username.length > 30) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Username must be 3-30 characters" },
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Username can only contain letters, numbers, and underscores" },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, updatedAt: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    // Rate limit: 1 username change per 30 days (check via audit log)
    const recentChange = await prisma.auditLog.findFirst({
      where: {
        targetUserId: userId,
        action: "USERNAME_CHANGE",
        createdAt: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    if (recentChange) {
      const nextAllowed = new Date(recentChange.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: `Username can only be changed once every 30 days. Next change allowed: ${nextAllowed.toISOString()}`,
        },
      });
    }

    // Check if username is taken
    const existing = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existing && existing.id !== userId) {
      return res.status(400).json({
        success: false,
        error: { code: "USERNAME_TAKEN", message: "Username already in use" },
      });
    }

    const oldUsername = user.username;

    // Update username and create audit log
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { username: username.toLowerCase() },
      }),
      prisma.auditLog.create({
        data: {
          actorId: userId,
          targetUserId: userId,
          action: "USERNAME_CHANGE",
          resource: "USER",
          resourceId: userId,
          metadata: { oldUsername, newUsername: username.toLowerCase() },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        message: "Username changed successfully",
        username: username.toLowerCase(),
      },
    });
  } catch (error) {
    console.error("Change username error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to change username" },
    });
  }
});

// GET /account/export - GDPR data export (all user data)
router.get("/export", authMiddleware(), async (req, res) => {
  try {
    const userId = req.user!.sub;

    // Fetch all user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        updatedAt: true,
        lastLoginAt: true,
        // OAuth connections (excluding tokens)
        identities: {
          select: {
            provider: true,
            providerUserId: true,
            createdAt: true,
          },
        },
        // Channel
        channel: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            description: true,
            avatarUrl: true,
            bannerUrl: true,
            links: true,
            location: true,
            contactEmail: true,
            subscriberCount: true,
            videoCount: true,
            createdAt: true,
          },
        },
        // Subscriptions
        subscriptions: {
          select: {
            channelId: true,
            notificationLevel: true,
            subscribedAt: true,
            channel: {
              select: {
                handle: true,
                displayName: true,
              },
            },
          },
        },
        // Notification settings
        notificationSettings: true,
        // Watch history (last 1000)
        watchHistory: {
          take: 1000,
          orderBy: { lastWatchedAt: "desc" },
          select: {
            videoId: true,
            lastWatchedAt: true,
            watchedSeconds: true,
            completed: true,
          },
        },
        // Comments (last 1000)
        comments: {
          take: 1000,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            videoId: true,
            content: true,
            createdAt: true,
            status: true,
          },
        },
        // Video reactions
        videoReactions: {
          select: {
            videoId: true,
            type: true,
            createdAt: true,
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

    // Format export
    const exportData = {
      exportedAt: new Date().toISOString(),
      dataController: "Play Video Platform",
      user: {
        ...user,
        identities: undefined,
        channel: undefined,
        subscriptions: undefined,
        notificationSettings: undefined,
        watchHistory: undefined,
        comments: undefined,
        videoReactions: undefined,
      },
      oauthConnections: user.identities,
      channel: user.channel,
      subscriptions: user.subscriptions,
      notificationSettings: user.notificationSettings,
      watchHistory: user.watchHistory,
      comments: user.comments,
      reactions: user.videoReactions,
    };

    // Set headers for download
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="user-data-export-${userId}.json"`);

    res.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    console.error("Export user data error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to export data" },
    });
  }
});

export default router;
