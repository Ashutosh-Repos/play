// Playlist types aligned with Prisma schema

import type { VideoVisibility } from "./video.js";

/**
 * Video in playlist
 */
export interface PlaylistVideoItem {
  id: string;
  position: number;
  addedAt: Date;
  video: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    duration: number | null;
    viewCount: number;
    publishedAt: Date | null;
    channelHandle: string | null;
    channelName: string | null;
    channelAvatarUrl: string | null;
  };
}

/**
 * Playlist summary for lists
 */
export interface PlaylistSummary {
  id: string;
  title: string;
  description: string | null;
  visibility: VideoVisibility;
  thumbnailUrl: string | null;
  videoCount: number;
  isSystem: boolean;
  systemType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Full playlist with videos
 */
export interface PlaylistDetail extends PlaylistSummary {
  videos: PlaylistVideoItem[];
  user?: {
    id: string;
    username: string;
    displayName: string;
  };
}

/**
 * Create playlist input
 */
export interface CreatePlaylistInput {
  title: string;
  description?: string;
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
}

/**
 * Update playlist input
 */
export interface UpdatePlaylistInput {
  title?: string;
  description?: string;
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  thumbnailUrl?: string | null;
}
