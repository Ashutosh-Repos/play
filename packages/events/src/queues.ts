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

  // User events
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",

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
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
} as const;
