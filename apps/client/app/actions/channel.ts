"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

export async function createChannel(data: CreateChannelInput) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = createChannelSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const handle = parsed.data.handle.toLowerCase();

  try {
    // Check if user already has a channel
    const existingChannel = await prisma.channel.findUnique({
      where: { userId: session.user.id },
    });

    if (existingChannel) {
      return { success: false, error: "You already have a channel" };
    }

    // Check if handle is taken
    const existingHandle = await prisma.channel.findUnique({
      where: { handle },
    });

    if (existingHandle) {
      return { success: false, error: "Handle already taken" };
    }

    // Create channel
    const channel = await prisma.channel.create({
      data: {
        userId: session.user.id,
        handle,
        displayName: parsed.data.displayName,
        description: parsed.data.description || null,
      },
    });

    revalidatePath("/settings/channel");
    revalidatePath(`/u/${session.user.username}`);
    return { success: true, data: { channelId: channel.id, handle: channel.handle } };
  } catch (error) {
    console.error("Create channel error:", error);
    return { success: false, error: "Failed to create channel" };
  }
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

export async function updateChannel(data: UpdateChannelInput) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = updateChannelSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  try {
    const channel = await prisma.channel.findUnique({
      where: { userId: session.user.id },
    });

    if (!channel) {
      return { success: false, error: "Channel not found" };
    }

    await prisma.channel.update({
      where: { id: channel.id },
      data: {
        displayName: parsed.data.displayName,
        description: parsed.data.description || null,
        avatarUrl: parsed.data.avatarUrl || null,
        bannerUrl: parsed.data.bannerUrl || null,
        location: parsed.data.location || null,
        contactEmail: parsed.data.contactEmail || null,
        links: parsed.data.links && parsed.data.links.length > 0 ? parsed.data.links : undefined,
      },
    });

    revalidatePath("/settings/channel");
    revalidatePath(`/u/${session.user.username}`);
    return { success: true };
  } catch (error) {
    console.error("Update channel error:", error);
    return { success: false, error: "Failed to update channel" };
  }
}

export async function deleteChannel() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const channel = await prisma.channel.findUnique({
      where: { userId: session.user.id },
    });

    if (!channel) {
      return { success: false, error: "Channel not found" };
    }

    // Soft delete
    await prisma.channel.update({
      where: { id: channel.id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/settings/channel");
    return { success: true };
  } catch (error) {
    console.error("Delete channel error:", error);
    return { success: false, error: "Failed to delete channel" };
  }
}
