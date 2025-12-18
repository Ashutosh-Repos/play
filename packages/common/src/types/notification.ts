// Notification types aligned with Prisma schema

/**
 * Notification type enum
 */
export type NotificationType =
  | "NEW_VIDEO"
  | "NEW_SUBSCRIBER"
  | "VIDEO_LIKE"
  | "COMMENT"
  | "COMMENT_REPLY"
  | "COMMENT_LIKE"
  | "MENTION"
  | "LIVE_STARTED"
  | "LIVE_SCHEDULED"
  | "SYSTEM";

/**
 * User notification settings
 */
export interface NotificationSettings {
  newVideos: boolean;
  liveStreams: boolean;
  comments: boolean;
  replies: boolean;
  likes: boolean;
  subscribers: boolean;
  mentions: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
}

/**
 * Notification item
 */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  imageUrl: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: Date;
}

/**
 * Update notification settings input
 */
export interface UpdateNotificationSettingsInput {
  newVideos?: boolean;
  liveStreams?: boolean;
  comments?: boolean;
  replies?: boolean;
  likes?: boolean;
  subscribers?: boolean;
  mentions?: boolean;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
}
