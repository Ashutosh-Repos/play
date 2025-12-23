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
      console.log(`[ActiveMiddleware] Checking status for userId: ${userId}`);
      console.log(`[Debug] DATABASE_URL prefix: ${process.env.DATABASE_URL?.substring(0, 20)}...`);
      
      const fs = await import("fs");
      fs.appendFileSync("engagement-debug.log", `[${new Date().toISOString()}] Checking userId: ${userId}\n`);
      fs.appendFileSync("engagement-debug.log", `[${new Date().toISOString()}] DATABASE_URL: ${process.env.DATABASE_URL}\n`);

      // 1. Check Cache
      let user = await getCachedUser(userId);

      // 2. Refresh Cache if missing
      if (!user) {
        console.log(`[ActiveMiddleware] Cache miss for ${userId}, fetching from DB...`);
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, status: true },
        });

        if (user) {
          console.log(`[ActiveMiddleware] Found user in DB: ${user.status}`);
          // Cache only minimal info needed matches user-service format
          await cacheUser(userId, user);
        } else {
             console.error(`[ActiveMiddleware] User NOT found in DB for id: ${userId}`);
        }
      } else {
          console.log(`[ActiveMiddleware] Cache hit for ${userId}: ${user.status}`);
      }

      if (!user) {
         return res.status(404).json({
          error: "User not found",
        });
      }

      // 3. Verify Status
      if (user.status !== "ACTIVE") {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "Your account is not active. Actions are restricted." }
        });
      }

      next();
    } catch (error) {
      console.error("Active user check error:", error);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to verify account status" }
      });
    }
  };
};
