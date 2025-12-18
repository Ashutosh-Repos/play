// Video types aligned with Prisma schema

export type VideoVisibility = "PUBLIC" | "UNLISTED" | "PRIVATE" | "SCHEDULED";
export type ProcessingStatus = "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED";

/**
 * Video - core video data
 */
export interface Video {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  tags: string[];
  categoryId?: string;
  language?: string;

  // Denormalized channel info
  channelHandle?: string;
  channelName?: string;
  channelAvatarUrl?: string;

  // Visibility
  visibility: VideoVisibility;
  scheduledAt?: Date;
  publishedAt?: Date;

  // Processing
  processingStatus: ProcessingStatus;
  processingError?: string;
  processingProgress?: number;

  // Files
  hlsPlaylistUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  resolutions: string[];

  // Engagement
  viewCount: bigint;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;

  // Settings
  allowComments: boolean;
  allowEmbedding: boolean;
  isAgeRestricted: boolean;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * Public video view (for API responses)
 */
export interface PublicVideo {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  duration?: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt?: Date;
  channelId: string;
  channelHandle?: string;
  channelName?: string;
  channelAvatarUrl?: string;
}

/**
 * Video card (for feed/list views)
 */
export interface VideoCard {
  id: string;
  title: string;
  thumbnailUrl?: string;
  duration?: number;
  viewCount: number;
  publishedAt?: Date;
  channelHandle?: string;
  channelName?: string;
  channelAvatarUrl?: string;
}

/**
 * Create video input
 */
export interface CreateVideoInput {
  title: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  visibility?: VideoVisibility;
  scheduledAt?: Date;
}

/**
 * Update video input
 */
export interface UpdateVideoInput {
  title?: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  visibility?: VideoVisibility;
  scheduledAt?: Date;
  thumbnailUrl?: string;
  allowComments?: boolean;
  allowEmbedding?: boolean;
  isAgeRestricted?: boolean;
}
