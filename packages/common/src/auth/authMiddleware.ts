// Express middleware for JWT authentication
import type { Request, Response, NextFunction } from "express";
import { verifyToken, extractTokenFromHeader, TokenPayload } from "./verifyToken.js";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export interface AuthOptions {
  required?: boolean;  // Default true - returns 401 if no token
}

/**
 * Express middleware to verify JWT token
 * Attaches user payload to req.user
 */
export function authMiddleware(options: AuthOptions = {}) {
  const { required = true } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      if (required) {
        return res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "No token provided" },
        });
      }
      return next();
    }

    const result = await verifyToken(token);

    if (!result.valid) {
      if (required) {
        return res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: result.error },
        });
      }
      return next();
    }

    // Enforce ACTIVE status for service access
    // PROVISIONED users should only access onboarding APIs (which are public/web-handled)
    if (result.payload?.status !== "ACTIVE") {
      if (required) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "Account not active" },
        });
      }
    }

    req.user = result.payload;
    next();
  };
}

/**
 * Middleware to require specific roles
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Not authenticated" },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }

    next();
  };
}

/**
 * Middleware for internal services behind API gateway
 * Supports both: JWT token (preferred) OR x-user-id header (gateway-injected)
 * Use this for services that may be called directly or via API gateway
 */
export function internalAuth(options: AuthOptions = {}) {
  const { required = true } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Try JWT first (preferred)
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      const result = await verifyToken(token);
      if (result.valid) {
        req.user = result.payload;
        return next();
      }
      // If JWT is present but invalid, reject
      if (required) {
        return res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: result.error },
        });
      }
    }

    // 2. Fallback to x-user-id header (API gateway pattern)
    const userId = req.headers["x-user-id"] as string;
    if (userId) {
      req.user = { sub: userId, role: "USER" } as TokenPayload;
      return next();
    }

    // 3. No auth found
    if (required) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "No authentication provided" },
      });
    }

    next();
  };
}
