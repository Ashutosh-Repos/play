// Express middleware for JWT authentication
import type { Request, Response, NextFunction } from "express";
import { verifyToken, extractTokenFromHeader, TokenPayload } from "./verifyToken";

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

  return (req: Request, res: Response, next: NextFunction) => {
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

    const result = verifyToken(token);

    if (!result.valid) {
      if (required) {
        return res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: result.error },
        });
      }
      return next();
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
