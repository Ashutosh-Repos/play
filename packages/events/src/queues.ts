// RabbitMQ queue/exchange definitions

export const EXCHANGES = {
  VIDEO: "video.events",
  USER: "user.events",
  ENGAGEMENT: "engagement.events",
  NOTIFICATION: "notification.events",
} as const;

export const QUEUES = {
  // Video processing pipeline
  VIDEO_UPLOADED: "video.uploaded",
  VIDEO_TRANSCODE: "video.transcode",
  VIDEO_TRANSCODED: "video.transcoded",
  VIDEO_PUBLISHED: "video.published",
  VIDEO_DELETED: "video.deleted",

  // User events
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
  USER_SUSPENDED: "user.suspended",
  USER_RESTORED: "user.restored",

  // Channel events
  CHANNEL_CREATED: "channel.created",
  CHANNEL_UPDATED: "channel.updated",
  CHANNEL_VERIFIED: "channel.verified",
  CHANNEL_DELETED: "channel.deleted",

  // Subscription events
  SUBSCRIPTION_CREATED: "subscription.created",
  SUBSCRIPTION_DELETED: "subscription.deleted",

  // Engagement
  VIDEO_VIEWED: "video.viewed",
  VIDEO_LIKED: "video.liked",
  COMMENT_CREATED: "comment.created",

  // Notifications
  NOTIFICATION_SEND: "notification.send",

  // Search indexing
  SEARCH_INDEX: "search.index",
} as const;

export const ROUTING_KEYS = {
  VIDEO_UPLOADED: "video.uploaded",
  VIDEO_TRANSCODING_STARTED: "video.transcoding.started",
  VIDEO_TRANSCODING_COMPLETED: "video.transcoding.completed",
  VIDEO_TRANSCODING_FAILED: "video.transcoding.failed",
  // Standardized transcode events (matching video-service consumer)
  TRANSCODE_PROGRESS: "transcode.progress",
  TRANSCODE_THUMBNAILS: "transcode.thumbnails",
  TRANSCODE_COMPLETED: "transcode.completed",
  TRANSCODE_FAILED: "transcode.failed",
  VIDEO_PUBLISHED: "video.published",
  VIDEO_DELETED: "video.deleted",
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
  USER_SUSPENDED: "user.suspended",
  USER_RESTORED: "user.restored",
  CHANNEL_CREATED: "channel.created",
  CHANNEL_UPDATED: "channel.updated",
  CHANNEL_VERIFIED: "channel.verified",
  CHANNEL_DELETED: "channel.deleted",
  SUBSCRIPTION_CREATED: "subscription.created",
  SUBSCRIPTION_DELETED: "subscription.deleted",
} as const;
