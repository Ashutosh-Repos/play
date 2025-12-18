// Admin routes
import { Router } from "express";
import { prisma } from "@repo/database";
import { authMiddleware, requireRole } from "@repo/common";
import { verifyChannelSchema } from "@repo/validation";
import { updateUserStatusSchema } from "../schemas.js";
import { emitUserSuspended, emitChannelVerified } from "../events/publisher.js";

const router = Router();

// GET /admin/users - List users
router.get("/users", authMiddleware(), requireRole("ADMIN"), async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const cursor = req.query.cursor as string | undefined;
    const status = req.query.status as "ACTIVE" | "SUSPENDED" | "BANNED" | undefined;
    const search = req.query.search as string | undefined;

    const where = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { username: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { displayName: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    // Get total count for pagination
    const totalCount = await prisma.user.count({ where });

    const users = await prisma.user.findMany({
      where,
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
        deletedAt: true,
        channel: {
          select: {
            id: true,
            handle: true,
            isVerified: true,
          },
        },
      },
    });

    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, -1) : users;

    res.json({
      success: true,
      data: {
        items,
        totalCount,
        nextCursor: hasMore ? items[items.length - 1]?.id : null,
      },
    });
  } catch (error) {
    console.error("Admin get users error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get users" },
    });
  }
});

// PATCH /admin/users/:id/status - Update user status
router.patch("/users/:id/status", authMiddleware(), requireRole("ADMIN"), async (req, res) => {
  try {
    const adminId = req.user!.sub;
    const { id } = req.params;

    // Prevent self-action
    if (id === adminId) {
      return res.status(400).json({
        success: false,
        error: { code: "SELF_ACTION", message: "Cannot modify your own status" },
      });
    }

    // Validate with Zod
    const parsed = updateUserStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { status, reason, until } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    // Update user status
    // Update user and revoke sessions if suspending/banning
    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          status,
          ...(status === "SUSPENDED" && {
            suspendedAt: new Date(),
            suspendedUntil: until ? new Date(until) : null,
            suspendedReason: reason,
          }),
          ...(status === "ACTIVE" && {
            suspendedAt: null,
            suspendedUntil: null,
            suspendedReason: null,
          }),
        },
        select: {
          id: true,
          username: true,
          status: true,
          suspendedAt: true,
          suspendedUntil: true,
          suspendedReason: true,
        },
      }),
      // Revoke sessions if blocking access
      ...(status === "SUSPENDED" || status === "BANNED"
        ? [prisma.refreshToken.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } })]
        : []),
    ]);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        targetUserId: id,
        action: status === "ACTIVE" ? "UNSUSPEND" : status,
        resource: "USER",
        resourceId: id!,
        reason: reason || undefined,
      },
    });

    // Emit event
    if (status === "SUSPENDED") {
      emitUserSuspended(id!, reason || "", until);
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Admin update status error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update status" },
    });
  }
});

// GET /admin/channels - List channels
router.get("/channels", authMiddleware(), requireRole("ADMIN"), async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const cursor = req.query.cursor as string | undefined;
    const search = req.query.search as string | undefined;

    const where = {
      ...(search && {
        OR: [
          { handle: { contains: search, mode: "insensitive" as const } },
          { displayName: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      deletedAt: null,
    };

    const totalCount = await prisma.channel.count({ where });

    const channels = await prisma.channel.findMany({
      where,
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        isVerified: true,
        subscriberCount: true,
        videoCount: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    const hasMore = channels.length > limit;
    const items = hasMore ? channels.slice(0, -1) : channels;

    res.json({
      success: true,
      data: {
        items,
        totalCount,
        nextCursor: hasMore ? items[items.length - 1]?.id : null,
      },
    });
  } catch (error) {
    console.error("Admin get channels error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get channels" },
    });
  }
});

// PATCH /admin/channels/:id/verify - Verify channel
router.patch("/channels/:id/verify", authMiddleware(), requireRole("ADMIN"), async (req, res) => {
  try {
    const adminId = req.user!.sub;
    const { id } = req.params;

    // Validate with Zod
    const parsed = verifyChannelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { verified } = parsed.data;

    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Channel not found" },
      });
    }

    const updated = await prisma.channel.update({
      where: { id },
      data: { isVerified: verified },
      select: {
        id: true,
        handle: true,
        isVerified: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: verified ? "VERIFY_CHANNEL" : "UNVERIFY_CHANNEL",
        resource: "CHANNEL",
        resourceId: id!,
      },
    });

    // Emit event
    if (verified) {
      emitChannelVerified(id!);
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Admin verify channel error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to verify channel" },
    });
  }
});

export default router;

