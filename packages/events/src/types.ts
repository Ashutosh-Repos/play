import { VideoPublishedPayload, CommentCreatedPayload, VideoLikedPayload } from "./schemas.js";

// ... (other imports or code)

export interface VideoPublishedEvent {
  type: "video.published";
  payload: VideoPublishedPayload;
}

export interface CommentCreatedEvent {
  type: "comment.created";
  payload: CommentCreatedPayload;
}

export interface VideoLikedEvent {
  type: "video.liked";
  payload: VideoLikedPayload;
}

// Notification events
export interface NotificationEvent {
  type: "notification.send";
  payload: {
    userId: string;
    notificationType: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  };
}

// Union type of all events
export type AppEvent =
  | VideoUploadedEvent
  | VideoTranscodingStartedEvent
  | VideoTranscodingCompletedEvent
  | VideoTranscodingFailedEvent
  | TranscodeProgressEvent
  | TranscodeThumbnailsEvent
  | TranscodeCompletedEvent
  | TranscodeFailedEvent
  | VideoPublishedEvent
  | VideoDeletedEvent
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | UserSuspendedEvent
  | UserRestoredEvent
  | ChannelCreatedEvent
  | ChannelUpdatedEvent
  | ChannelVerifiedEvent
  | ChannelDeletedEvent
  | SubscriptionCreatedEvent
  | SubscriptionDeletedEvent
  | VideoViewedEvent
  | VideoLikedEvent
  | CommentCreatedEvent
  | NotificationEvent;

// Event type definitions for RabbitMQ

// Video events
export interface VideoUploadedEvent {
  type: "video.uploaded";
  payload: {
    videoId: string;
    userId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
  };
}

export interface VideoTranscodingStartedEvent {
  type: "video.transcoding.started";
  payload: {
    videoId: string;
    resolutions: string[];
    startedAt: string;
  };
}

// Standardized events
export interface TranscodeProgressEvent {
  type: "transcode.progress";
  payload: {
    videoId: string;
    progress: number;
    stage: string;
  };
}

export interface TranscodeThumbnailsEvent {
  type: "transcode.thumbnails";
  payload: {
    videoId: string;
    thumbnailOptions: string[];
  };
}

export interface TranscodeCompletedEvent {
  type: "transcode.completed";
  payload: {
    videoId: string;
    hlsPlaylistUrl: string;
    thumbnailOptions: string[];
    previewSprite?: string;
    duration: number;
    width: number;
    height: number;
    fps: number;
    resolutions: string[];
  };
}

export interface TranscodeFailedEvent {
  type: "transcode.failed";
  payload: {
    videoId: string;
    error: string;
    stage: string;
    retryable: boolean;
  };
}

/** @deprecated Use TranscodeCompletedEvent */
export interface VideoTranscodingCompletedEvent {
  type: "video.transcoding.completed";
  payload: {
    videoId: string;
    outputs: {
      resolution: string;
      url: string;
    }[];
    completedAt: string;
  };
}

/** @deprecated Use TranscodeFailedEvent */
export interface VideoTranscodingFailedEvent {
  type: "video.transcoding.failed";
  payload: {
    videoId: string;
    error: string;
    failedAt: string;
  };
}

// VideoPublishedEvent imported from schemas

export interface VideoDeletedEvent {
  type: "video.deleted";
  payload: {
    videoId: string;
    channelId: string;
    deletedAt: string;
  };
}

// User events
export interface UserCreatedEvent {
  type: "user.created";
  payload: {
    userId: string;
    email: string;
    username: string;
    createdAt: string;
  };
}

export interface UserUpdatedEvent {
  type: "user.updated";
  payload: {
    userId: string;
    changes: Record<string, unknown>;
    updatedAt: string;
  };
}

export interface UserDeletedEvent {
  type: "user.deleted";
  payload: {
    userId: string;
    deletedAt: string;
  };
}

export interface UserSuspendedEvent {
  type: "user.suspended";
  payload: {
    userId: string;
    reason: string;
    until?: string;
    suspendedAt: string;
  };
}

export interface UserRestoredEvent {
  type: "user.restored";
  payload: {
    userId: string;
    restoredAt: string;
  };
}

// Channel events
export interface ChannelCreatedEvent {
  type: "channel.created";
  payload: {
    channelId: string;
    userId: string;
    handle: string;
    createdAt: string;
  };
}

export interface ChannelUpdatedEvent {
  type: "channel.updated";
  payload: {
    channelId: string;
    changes: Record<string, unknown>;
    updatedAt: string;
  };
}

export interface ChannelVerifiedEvent {
  type: "channel.verified";
  payload: {
    channelId: string;
    verifiedAt: string;
  };
}

export interface ChannelDeletedEvent {
  type: "channel.deleted";
  payload: {
    channelId: string;
    userId: string;
    deletedAt: string;
  };
}

// Subscription events
export interface SubscriptionCreatedEvent {
  type: "subscription.created";
  payload: {
    subscriberId: string;
    channelId: string;
    subscribedAt: string;
  };
}

export interface SubscriptionDeletedEvent {
  type: "subscription.deleted";
  payload: {
    subscriberId: string;
    channelId: string;
    deletedAt: string;
  };
}

// Engagement events
export interface VideoViewedEvent {
  type: "video.viewed";
  payload: {
    videoId: string;
    userId?: string;
    watchDuration: number;
    viewedAt: string;
  };
}


