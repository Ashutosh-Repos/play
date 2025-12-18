// API response types

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Pagination input
 */
export interface PaginationInput {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Auth errors
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  USER_SUSPENDED: "USER_SUSPENDED",
  USER_BANNED: "USER_BANNED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",

  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  DUPLICATE_EMAIL: "DUPLICATE_EMAIL",
  DUPLICATE_USERNAME: "DUPLICATE_USERNAME",
  DUPLICATE_HANDLE: "DUPLICATE_HANDLE",

  // Not found errors
  USER_NOT_FOUND: "USER_NOT_FOUND",
  CHANNEL_NOT_FOUND: "CHANNEL_NOT_FOUND",
  VIDEO_NOT_FOUND: "VIDEO_NOT_FOUND",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
