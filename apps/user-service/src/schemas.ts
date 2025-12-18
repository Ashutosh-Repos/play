// Zod validation schemas for user-service
// Re-exports from @repo/validation for convenience + local extensions

// Re-export shared schemas
export {
  // Channel
  createChannelSchema,
  updateChannelSchema,
  verifyChannelSchema,
  type CreateChannelInput,
  type UpdateChannelInput,
  type VerifyChannelInput,
  // Common
  paginationSchema,
  type PaginationInput,
  // Enums
  SubscriptionNotificationLevel,
  UserStatus,
  UserRole,
} from "@repo/validation";

import { z } from "zod";

// ==================== User Profile (local) ====================

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ==================== Subscriptions (local) ====================

export const subscriptionNotificationLevelSchema = z.enum([
  "ALL",
  "PERSONALIZED",
  "NONE",
]);

export const updateSubscriptionSchema = z.object({
  notificationLevel: subscriptionNotificationLevelSchema,
});

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

// ==================== Notification Settings (local) ====================

export const updateNotificationSettingsSchema = z.object({
  newVideos: z.boolean().optional(),
  liveStreams: z.boolean().optional(),
  comments: z.boolean().optional(),
  replies: z.boolean().optional(),
  likes: z.boolean().optional(),
  subscribers: z.boolean().optional(),
  mentions: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});

export type UpdateNotificationSettingsInput = z.infer<
  typeof updateNotificationSettingsSchema
>;

// ==================== Admin (local) ====================

export const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
  reason: z.string().max(500).optional(),
  until: z.string().datetime().optional(),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

// ==================== Query Params (local) ====================

export const adminUsersQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]).optional(),
  search: z.string().optional(),
});

export type AdminUsersQueryInput = z.infer<typeof adminUsersQuerySchema>;
