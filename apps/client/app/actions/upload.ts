"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { revalidatePath } from "next/cache";
import { uploadAvatar, uploadChannelAvatar, uploadChannelBanner } from "@/lib/storage";

export async function uploadImage(
  formData: FormData,
  type: "avatar" | "banner" | "channel-avatar" | "channel-banner"
) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: "Invalid file type. Use JPEG, PNG, WebP, or GIF." };
  }

  // Validate file size (5MB for avatar, 10MB for banner)
  const maxSize = type.includes("banner") ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxSize) {
    const maxMB = maxSize / 1024 / 1024;
    return { success: false, error: `File too large. Maximum ${maxMB}MB.` };
  }

  try {
    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    let url: string;

    // Upload based on type
    if (type === "avatar") {
      url = await uploadAvatar(session.user.id, buffer, file.type);
      
      // Update user avatar in database
      await prisma.user.update({
        where: { id: session.user.id },
        data: { avatarUrl: url },
      });
      revalidatePath("/settings/profile");
      
    } else if (type === "channel-avatar" || type === "channel-banner") {
      // Get user's channel
      const channel = await prisma.channel.findUnique({
        where: { userId: session.user.id },
      });
      
      if (!channel) {
        return { success: false, error: "Channel not found" };
      }

      if (type === "channel-avatar") {
        url = await uploadChannelAvatar(channel.id, buffer, file.type);
        await prisma.channel.update({
          where: { id: channel.id },
          data: { avatarUrl: url },
        });
      } else {
        url = await uploadChannelBanner(channel.id, buffer, file.type);
        await prisma.channel.update({
          where: { id: channel.id },
          data: { bannerUrl: url },
        });
      }
      revalidatePath("/settings/channel");
    } else {
      return { success: false, error: "Invalid upload type" };
    }

    return { success: true, url };
  } catch (error) {
    console.error("Upload error:", error);
    return { success: false, error: "Failed to upload image" };
  }
}
