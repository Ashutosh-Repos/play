// Channel validation schemas
import { z } from "zod";
import { optionalUrlSchema } from "./common";

/**
 * Channel link schema
 */
export const channelLinkSchema = z.object({
  title: z.string().max(30),
  url: z.string().url(),
});

/**
 * Create channel schema
 */
export const createChannelSchema = z.object({
  handle: z
    .string()
    .min(3, "Handle must be at least 3 characters")
    .max(30)
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Handle can only contain letters, numbers, and underscores"
    ),
  displayName: z.string().min(1).max(50).optional(),
  description: z.string().max(5000).optional(),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;

/**
 * Update channel schema
 */
export const updateChannelSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  description: z.string().max(5000).optional(),
  avatarUrl: optionalUrlSchema,
  bannerUrl: optionalUrlSchema,
  links: z.array(channelLinkSchema).max(10).optional(),
  location: z.string().max(100).optional(),
  contactEmail: z.string().email().optional().nullable(),
});

export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;

/**
 * Update channel verification schema (admin only)
 */
export const verifyChannelSchema = z.object({
  verified: z.boolean().default(true),
});

export type VerifyChannelInput = z.infer<typeof verifyChannelSchema>;
