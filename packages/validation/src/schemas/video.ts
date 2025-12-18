// Video validation schemas
import { z } from "zod";
import { VideoVisibility, ProcessingStatus } from "./enums";
import { tagsSchema, optionalUrlSchema } from "./common";

// ==================== Create/Update ====================

/**
 * Create video draft schema
 */
export const createVideoSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().max(5000).optional(),
  categoryId: z.string().optional(),
  tags: tagsSchema,
  language: z.string().max(10).optional(),
  visibility: VideoVisibility.default("PRIVATE"),
});

export type CreateVideoInput = z.infer<typeof createVideoSchema>;

/**
 * Update video schema
 */
export const updateVideoSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(5000).optional(),
  categoryId: z.string().optional().nullable(),
  tags: tagsSchema,
  language: z.string().max(10).optional(),
  thumbnailUrl: optionalUrlSchema,
  allowComments: z.boolean().optional(),
  allowEmbedding: z.boolean().optional(),
  isAgeRestricted: z.boolean().optional(),
});

export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;

/**
 * Publish video schema
 */
export const publishVideoSchema = z.object({
  visibility: z.enum(["PUBLIC", "UNLISTED", "SCHEDULED"]).default("PUBLIC"),
  scheduledAt: z.string().datetime().optional(),
});

export type PublishVideoInput = z.infer<typeof publishVideoSchema>;

// ==================== Upload ====================

/**
 * Upload initiation schema
 */
export const uploadVideoSchema = z.object({
  fileName: z.string().min(1).max(255),
});

export type UploadVideoInput = z.infer<typeof uploadVideoSchema>;

// ==================== Internal/Service ====================

/**
 * Update video upload status (from ingest-service)
 */
export const updateVideoUploadSchema = z.object({
  status: z.enum(["UPLOADING", "PROCESSING"]),
  originalFileName: z.string().optional(),
  originalFileSize: z.number().optional(),
  originalFilePath: z.string().optional(),
  originalMimeType: z.string().optional(),
  uploadId: z.string().optional(),
});

export type UpdateVideoUploadInput = z.infer<typeof updateVideoUploadSchema>;

/**
 * Update video transcode result (from transcoder-service)
 */
export const updateVideoTranscodeSchema = z.object({
  processingStatus: z.enum(["READY", "FAILED"]),
  processingError: z.string().optional(),
  hlsPlaylistUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  thumbnailOptions: z.array(z.string()).optional(),
  previewSprite: z.string().optional(),
  duration: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  fps: z.number().optional(),
  resolutions: z.array(z.string()).optional(),
});

export type UpdateVideoTranscodeInput = z.infer<typeof updateVideoTranscodeSchema>;

// ==================== Query ====================

/**
 * Video list query schema
 */
export const videoListQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  visibility: VideoVisibility.optional(),
  categoryId: z.string().optional(),
  channelId: z.string().optional(),
  status: ProcessingStatus.optional(),
});

export type VideoListQueryInput = z.infer<typeof videoListQuerySchema>;
