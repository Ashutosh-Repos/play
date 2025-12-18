// Zod validation schemas for video-service
// Re-exports from @repo/validation for convenience + local extensions

// Re-export all shared schemas
export {
  // Video
  createVideoSchema,
  updateVideoSchema,
  publishVideoSchema,
  uploadVideoSchema,
  updateVideoUploadSchema,
  updateVideoTranscodeSchema,
  videoListQuerySchema,
  type CreateVideoInput,
  type UpdateVideoInput,
  type PublishVideoInput,
  type UploadVideoInput,
  type UpdateVideoUploadInput,
  type UpdateVideoTranscodeInput,
  type VideoListQueryInput,
  // Playlist
  createPlaylistSchema,
  updatePlaylistSchema,
  addVideoToPlaylistSchema,
  reorderPlaylistVideosSchema,
  type CreatePlaylistInput,
  type UpdatePlaylistInput,
  type AddVideoToPlaylistInput,
  type ReorderPlaylistVideosInput,
  // Common
  paginationSchema,
  type PaginationInput,
  // Enums
  VideoVisibility,
  ProcessingStatus,
} from "@repo/validation";

// ==================== Local Schemas (video-service specific) ====================

import { z } from "zod";

// Legacy alias for addVideoToPlaylistSchema (used in some routes)
export { addVideoToPlaylistSchema as addToPlaylistSchema } from "@repo/validation";
export type AddToPlaylistInput = z.infer<typeof addVideoToPlaylistSchema>;
import { addVideoToPlaylistSchema } from "@repo/validation";

// ==================== Categories (admin only, local for now) ====================

export const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  iconUrl: z.string().url().optional(),
  sortOrder: z.number().int().default(0),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
