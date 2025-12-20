// JWT verification for microservices
import jwt from "jsonwebtoken";
import type { UserRole, UserStatus } from "../types/index.js";

// Read AUTH_SECRET lazily to allow environment to be loaded
const getAuthSecret = () => process.env.AUTH_SECRET || process.env.JWT_SECRET || "";

export interface TokenPayload {
  sub: string;        // userId
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  channelId?: string | null;
  iat: number;
  exp: number;
}

export interface VerifyResult {
  valid: boolean;
  payload?: TokenPayload;
  error?: string;
}

// Import decode from next-auth using dynamic import or conditional require to avoid errors if missing 
// But since we installed it, we can import
import { decode } from "next-auth/jwt";

/**
 * Verify JWT token and extract payload
 * Support both signed JWS (internal) and encrypted JWE (NextAuth)
 */
export async function verifyToken(token: string): Promise<VerifyResult> {
  const AUTH_SECRET = getAuthSecret();
  if (!AUTH_SECRET) {
    return { valid: false, error: "AUTH_SECRET not configured" };
  }

  // 1. Try JWS (Signed)
  try {
    const payload = jwt.verify(token, AUTH_SECRET) as TokenPayload;
    return { valid: true, payload };
  } catch (jwsError) {
    // 2. Try JWE (NextAuth)
    try {
      const decoded = await decode({ token, secret: AUTH_SECRET, salt: "" }); // salt is optional/auto-detected usually?
      // Note: next-auth decode might need proper salt if using specific cookie name logic, 
      // but usually 'salt' param is used to derive key? No, 'secret' is key.
      
      if (decoded) {
        if (!decoded.sub && !decoded.id) {
            return { valid: false, error: "Token missing subject" };
        }

        // Map NextAuth JWT to our TokenPayload
        const payload: TokenPayload = {
           sub: (decoded.sub || decoded.id) as string,
           email: decoded.email as string,
           username: decoded.username as string,
           role: decoded.role as UserRole,
           status: decoded.status as UserStatus,
           channelId: decoded.channelId as string | null,
           iat: decoded.iat as number,
           exp: decoded.exp as number
        };
        return { valid: true, payload };
      }
    } catch (jweError) {
      // Both failed
    }

    if (jwsError instanceof jwt.TokenExpiredError) {
      return { valid: false, error: "Token expired" };
    }
    return { valid: false, error: "Invalid token" };
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

/**
 * Create a signed JWT token for service-to-service communication
 * Uses the shared AUTH_SECRET
 */
export function createServiceToken(payload: Omit<TokenPayload, "iat" | "exp">, expiresIn = "5m"): string {
  const AUTH_SECRET = getAuthSecret();
  if (!AUTH_SECRET) {
    throw new Error("AUTH_SECRET not configured");
  }

  // Sign with strict short expiration
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] });
}
