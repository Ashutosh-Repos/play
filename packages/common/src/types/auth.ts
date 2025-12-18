// Auth types for JWT and session management
import type { UserRole, UserStatus } from "./user";

/**
 * JWT Payload - embedded in token
 * Keep minimal to reduce token size
 */
export interface JWTPayload {
  /** User ID (sub claim) */
  sub: string;
  /** User email */
  email: string;
  /** User role */
  role: UserRole;
  /** Channel ID if user has one */
  channelId?: string;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expires at (Unix timestamp) */
  exp: number;
}

/**
 * Session user - available in NextAuth session
 */
export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  channelId?: string;
  channelHandle?: string;
}

/**
 * Auth user - returned from user-service login
 * Used by NextAuth for session/token management
 */
export interface AuthUser {
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
}

/**
 * Extended NextAuth session
 */
export interface Session {
  user: SessionUser;
  accessToken: string;
  expires: string;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data
 */
export interface RegisterData {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

/**
 * Auth response from login/register
 */
export interface AuthResponse {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Token refresh request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Decoded token for microservices
 */
export interface DecodedToken extends JWTPayload {
  /** Token is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
}
