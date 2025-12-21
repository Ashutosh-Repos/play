import { Request, Response, NextFunction } from "express";
import { prisma } from "@repo/database";
import { redis } from "../lib/redis.js";

// Extended Request interface
interface AuthRequest extends Request {
  user?: any;
}

const CACHE_TTL_USER = 60 * 5; // 5 minutes

// Helper to get cached user
async function getCachedUser(userId: string) {
  const cached = await redis.get(`user:${userId}`);
  return cached ? JSON.parse(cached) : null;
}

// Helper to cache user
async function cacheUser(userId: string, data: object) {
  await redis.set(
    `user:${userId}`,
    JSON.stringify(data),
    "EX",
    CACHE_TTL_USER
  );
}

export const requireActiveUser = () => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.sub) {
        return res.status(401).json({
          error: "Authentication required",
        });
      }

      const userId = req.user.sub;

      // 1. Check Cache
      let user = await getCachedUser(userId);

      // 2. Refresh Cache if missing
      if (!user) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, status: true },
        });

        if (user) {
          // Cache only minimal info needed matches user-service format
          await cacheUser(userId, user);
        }
      }

      if (!user) {
         return res.status(404).json({
          error: "User not found",
        });
      }

      // 3. Verify Status
      if (user.status !== "ACTIVE") {
        return res.status(403).json({
          error: "Your account is not active. Actions are restricted.",
        });
      }

      next();
    } catch (error) {
      console.error("Active user check error:", error);
      res.status(500).json({
        error: "Failed to verify account status",
      });
    }
  };
};
