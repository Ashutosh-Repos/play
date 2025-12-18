// Enum schemas matching Prisma enums
import { z } from "zod";

// ==================== Video Enums ====================

export const VideoVisibility = z.enum([
  "PUBLIC",
  "UNLISTED",
  "PRIVATE",
  "SCHEDULED",
]);
export type VideoVisibility = z.infer<typeof VideoVisibility>;

export const ProcessingStatus = z.enum([
  "PENDING",
  "UPLOADING",
  "PROCESSING",
  "READY",
  "FAILED",
]);
export type ProcessingStatus = z.infer<typeof ProcessingStatus>;

// ==================== User Enums ====================

export const UserRole = z.enum(["USER", "ADMIN"]);
export type UserRole = z.infer<typeof UserRole>;

export const UserStatus = z.enum(["ACTIVE", "SUSPENDED", "BANNED"]);
export type UserStatus = z.infer<typeof UserStatus>;

// ==================== Engagement Enums ====================

export const ReactionType = z.enum(["LIKE", "DISLIKE"]);
export type ReactionType = z.infer<typeof ReactionType>;

export const CommentStatus = z.enum(["VISIBLE", "HIDDEN", "HELD", "REMOVED"]);
export type CommentStatus = z.infer<typeof CommentStatus>;

// ==================== Subscription Enums ====================

export const SubscriptionNotificationLevel = z.enum([
  "ALL",
  "PERSONALIZED",
  "NONE",
]);
export type SubscriptionNotificationLevel = z.infer<
  typeof SubscriptionNotificationLevel
>;

// ==================== Notification Enums ====================

export const NotificationType = z.enum([
  "NEW_VIDEO",
  "NEW_SUBSCRIBER",
  "VIDEO_LIKE",
  "COMMENT",
  "COMMENT_REPLY",
  "COMMENT_LIKE",
  "MENTION",
  "LIVE_STARTED",
  "LIVE_SCHEDULED",
  "SYSTEM",
]);
export type NotificationType = z.infer<typeof NotificationType>;

// ==================== Report Enums ====================

export const ReportReason = z.enum([
  "SPAM",
  "HARASSMENT",
  "HATE_SPEECH",
  "VIOLENCE",
  "NUDITY",
  "MISINFORMATION",
  "COPYRIGHT",
  "OTHER",
]);
export type ReportReason = z.infer<typeof ReportReason>;

export const ReportStatus = z.enum([
  "PENDING",
  "REVIEWED",
  "ACTIONED",
  "DISMISSED",
]);
export type ReportStatus = z.infer<typeof ReportStatus>;
