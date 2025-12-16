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

export interface VideoTranscodingFailedEvent {
  type: "video.transcoding.failed";
  payload: {
    videoId: string;
    error: string;
    failedAt: string;
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

export interface VideoLikedEvent {
  type: "video.liked";
  payload: {
    videoId: string;
    userId: string;
    likedAt: string;
  };
}

export interface CommentCreatedEvent {
  type: "comment.created";
  payload: {
    commentId: string;
    videoId: string;
    userId: string;
    content: string;
    createdAt: string;
  };
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
  | UserCreatedEvent
  | UserUpdatedEvent
  | VideoViewedEvent
  | VideoLikedEvent
  | CommentCreatedEvent
  | NotificationEvent;
