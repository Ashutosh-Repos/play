// Token utilities for hybrid auth
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@repo/database";
import type { UserRole, UserStatus } from "@repo/common";

const AUTH_SECRET = process.env.AUTH_SECRET || "";
const ACCESS_TOKEN_EXPIRES = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRES = 7 * 24 * 60 * 60; // 7 days

export interface TokenPayload {
  sub: string;
  email: string;
  username: string;
  role: UserRole;
  channelId?: string | null;
}

/**
 * Generate access token (JWT)
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

/**
 * Generate refresh token (random string)
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash token for storage
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create refresh token in database
 */
export async function createRefreshToken(
  userId: string,
  token: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent,
      ipAddress,
    },
  });
}

/**
 * Validate and rotate refresh token
 * Returns user if valid, null otherwise
 */
export async function rotateRefreshToken(
  token: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    status: UserStatus;
    channelId?: string | null;
  };
  newRefreshToken: string;
} | null> {
  const tokenHash = hashToken(token);

  // Find token
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: { channel: true },
      },
    },
  });

  // Validate
  if (!storedToken) return null;
  if (storedToken.revokedAt) return null;
  if (storedToken.expiresAt < new Date()) return null;
  if (storedToken.user.status !== "ACTIVE") return null;

  // Generate new token
  const newRefreshToken = generateRefreshToken();
  const newTokenHash = hashToken(newRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES * 1000);

  // Rotate: revoke old, create new
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revokedAt: new Date(),
        replacedBy: newTokenHash,
      },
    }),
    prisma.refreshToken.create({
      data: {
        userId: storedToken.userId,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
        userAgent,
        ipAddress,
      },
    }),
  ]);

  return {
    user: {
      id: storedToken.user.id,
      email: storedToken.user.email,
      username: storedToken.user.username,
      role: storedToken.user.role as UserRole,
      status: storedToken.user.status as UserStatus,
      channelId: storedToken.user.channel?.id ?? null,
    },
    newRefreshToken,
  };
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
