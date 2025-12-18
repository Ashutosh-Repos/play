// JWT verification for microservices
// Microservices use this to verify tokens from Next.js auth
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthUser, UserRole, UserStatus } from "../types/index";

const JWT_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || "";

// Use separate interface to avoid conflict with Express global Request.user
export interface AuthenticatedRequest extends Omit<Request, "user"> {
  user?: JWTPayload["user"];
}

export interface JWTPayload {
  user?: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    role: UserRole;
    status: UserStatus;
    emailVerified: boolean;
    channelId?: string | null;
    channelHandle?: string | null;
  };
  sub?: string;
  iat?: number;
  exp?: number;
}

/**
 * Middleware to verify JWT token from Authorization header
 * Use in microservices to protect routes
 */
export function verifyToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "No token provided" },
    });
  }

  const token = authHeader.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid token format" },
    });
  }

  if (!JWT_SECRET || JWT_SECRET.length === 0) {
    console.error("JWT_SECRET not configured");
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Server configuration error" },
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // NextAuth stores user in token.user
    if (decoded.user) {
      req.user = decoded.user;
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: { code: "TOKEN_EXPIRED", message: "Token expired" },
      });
    }

    return res.status(401).json({
      success: false,
      error: { code: "TOKEN_INVALID", message: "Invalid token" },
    });
  }
}

/**
 * Optional version - doesn't fail if no token, just sets req.user if valid
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];

  if (!token || !JWT_SECRET) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    if (decoded.user) {
      req.user = decoded.user;
    }
  } catch {
    // Ignore errors, just proceed without user
  }

  next();
}

/**
 * Require specific role
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }

    next();
  };
}
