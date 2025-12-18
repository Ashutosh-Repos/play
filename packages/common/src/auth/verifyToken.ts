// JWT verification for microservices
import jwt from "jsonwebtoken";
import type { UserRole } from "../types";

const AUTH_SECRET = process.env.AUTH_SECRET || "";

export interface TokenPayload {
  sub: string;        // userId
  email: string;
  username: string;
  role: UserRole;
  channelId?: string | null;
  iat: number;
  exp: number;
}

export interface VerifyResult {
  valid: boolean;
  payload?: TokenPayload;
  error?: string;
}

/**
 * Verify JWT token and extract payload
 */
export function verifyToken(token: string): VerifyResult {
  if (!AUTH_SECRET) {
    return { valid: false, error: "AUTH_SECRET not configured" };
  }

  try {
    const payload = jwt.verify(token, AUTH_SECRET) as TokenPayload;
    return { valid: true, payload };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: "Token expired" };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: "Invalid token" };
    }
    return { valid: false, error: "Token verification failed" };
  }
}

/**
 * Extract token from Authorization header
 * Supports: "Bearer <token>" format
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }
  
  return parts[1] ?? null;
}
