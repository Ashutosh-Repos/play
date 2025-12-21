import { Request, Response, NextFunction } from "express";
import { prisma } from "@repo/database";
import { getCachedUser, cacheUser } from "../lib/redis.js";

// Use a looser type to avoid conflicts with Express.Request
// In a real app, we'd augment the global Express namespace
interface AuthRequest extends Request {
  user?: any;
}

export const requireActiveUser = () => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.sub) {
        return res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
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
          // Cache only minimal info needed
          await cacheUser(userId, user);
        }
      }

      if (!user) {
         return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "User not found" },
        });
      }

      // 3. Verify Status
      if (user.status !== "ACTIVE") {
        return res.status(403).json({
          success: false,
          error: { 
            code: "ACCOUNT_SUSPENDED", 
            message: "Your account is not active. Actions are restricted." 
          },
        });
      }

      next();
    } catch (error) {
      console.error("Active user check error:", error);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to verify account status" },
      });
    }
  };
};
