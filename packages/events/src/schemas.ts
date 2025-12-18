import { z } from "zod";

export const VideoPublishedSchema = z.object({
  videoId: z.string(),
  channelId: z.string(),
  title: z.string(),
  thumbnailUrl: z.string().optional(),
  publishedAt: z.string().or(z.date()).transform((val: string | Date) => new Date(val)),
});

export const CommentCreatedSchema = z.object({
  commentId: z.string(),
  videoId: z.string(),
  userId: z.string(),
  content: z.string(),
  createdAt: z.string().or(z.date()).transform((val: string | Date) => new Date(val)),
});

export const VideoLikedSchema = z.object({
  videoId: z.string(),
  userId: z.string(),
  type: z.enum(["LIKE", "DISLIKE"]),
  timestamp: z.string().or(z.date()).transform((val: string | Date) => new Date(val)),
});

export type VideoPublishedPayload = z.infer<typeof VideoPublishedSchema>;
export type CommentCreatedPayload = z.infer<typeof CommentCreatedSchema>;
export type VideoLikedPayload = z.infer<typeof VideoLikedSchema>;
