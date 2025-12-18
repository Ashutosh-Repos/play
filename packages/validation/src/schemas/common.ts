// Common validation schemas shared across all services
import { z } from "zod";

// ==================== Pagination ====================

/**
 * Cursor-based pagination schema
 * Used for all list endpoints
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * Paginated response schema factory
 */
export const cursorPaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
  });

// ==================== Common Validators ====================

/**
 * CUID ID schema
 */
export const idSchema = z.string().min(1, "ID is required");

/**
 * URL schema (optional, nullable)
 */
export const optionalUrlSchema = z.string().url().optional().nullable();

/**
 * Required URL schema
 */
export const urlSchema = z.string().url();

/**
 * Safe string (trimmed, no dangerous chars)
 */
export const safeStringSchema = (min = 1, max = 255) =>
  z.string().min(min).max(max).trim();

/**
 * Tags array schema
 */
export const tagsSchema = z.array(z.string().max(30)).max(30).optional();
