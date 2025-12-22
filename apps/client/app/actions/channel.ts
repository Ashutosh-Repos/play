"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { channelService } from "@/lib/service-client";

const createChannelSchema = z.object({
  handle: z
    .string()
    .min(3, "Handle must be at least 3 characters")
    .max(30, "Handle must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
  displayName: z.string().min(1, "Display name is required").max(50, "Max 50 characters"),
  description: z.string().max(1000, "Max 1000 characters").optional(),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;

/**
 * Create a new channel for the current user
 */
export async function createChannel(data: CreateChannelInput) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = createChannelSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  // Call user-service to create channel (handles uniqueness + events)
  const result = await channelService.create({
    handle: parsed.data.handle.toLowerCase(),
    displayName: parsed.data.displayName,
    description: parsed.data.description,
  });

  if (!result.success) {
    return { success: false, error: result.error?.message || "Failed to create channel" };
  }

  revalidatePath("/settings/channel");
  revalidatePath(`/u/${session.user.username}`);
  return { success: true, data: result.data };
}

const updateChannelSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(50, "Max 50 characters"),
  description: z.string().max(1000, "Max 1000 characters").optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  location: z.string().max(100).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  links: z
    .array(
      z.object({
        title: z.string().max(50),
        url: z.string().url(),
      })
    )
    .max(10)
    .optional(),
});

export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;

/**
 * Update the current user's channel
 */
export async function updateChannel(data: UpdateChannelInput) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = updateChannelSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  // Get current channel via service instead of Prisma
  const myChannel = await channelService.getMe();
  if (!myChannel.success || !myChannel.data) {
    return { success: false, error: "Channel not found" };
  }

  // Call user-service to update channel (emits events)
  const result = await channelService.update(myChannel.data.handle, {
    displayName: parsed.data.displayName,
    description: parsed.data.description || undefined,
    avatarUrl: parsed.data.avatarUrl || undefined,
    bannerUrl: parsed.data.bannerUrl || undefined,
    location: parsed.data.location || undefined,
    contactEmail: parsed.data.contactEmail || undefined,
    links: parsed.data.links && parsed.data.links.length > 0 ? parsed.data.links : undefined,
  });

  if (!result.success) {
    return { success: false, error: result.error?.message || "Failed to update channel" };
  }

  revalidatePath("/settings/channel");
  revalidatePath(`/u/${session.user.username}`);
  return { success: true };
}

/**
 * Delete the current user's channel
 */
export async function deleteChannel() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  // Get current channel via service instead of Prisma
  const myChannel = await channelService.getMe();
  if (!myChannel.success || !myChannel.data) {
    return { success: false, error: "Channel not found" };
  }

  // Call user-service for proper event emission
  const result = await channelService.delete(myChannel.data.handle);

  if (!result.success) {
    return { success: false, error: result.error?.message || "Failed to delete channel" };
  }

  revalidatePath("/settings/channel");
  return { success: true };
}
