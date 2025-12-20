// Playlist validation schemas
import { z } from "zod";
import { optionalUrlSchema, idSchema } from "./common.js";

/**
 * Create playlist schema
 */
export const createPlaylistSchema = z.object({
  title: z.string().min(1, "Title is required").max(150),
  description: z.string().max(5000).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).default("PUBLIC"),
});

export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>;

/**
 * Update playlist schema
 */
export const updatePlaylistSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  description: z.string().max(5000).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
  thumbnailUrl: optionalUrlSchema,
});

export type UpdatePlaylistInput = z.infer<typeof updatePlaylistSchema>;

/**
 * Add video to playlist schema
 */
export const addVideoToPlaylistSchema = z.object({
  videoId: idSchema,
  position: z.number().int().min(0).optional(),
});

export type AddVideoToPlaylistInput = z.infer<typeof addVideoToPlaylistSchema>;

/**
 * Reorder playlist videos schema
 */
export const reorderPlaylistVideosSchema = z.object({
  videoIds: z.array(idSchema).min(1),
});

export type ReorderPlaylistVideosInput = z.infer<typeof reorderPlaylistVideosSchema>;
