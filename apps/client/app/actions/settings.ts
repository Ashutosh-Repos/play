"use server";

import { auth } from "@/lib/auth";
import { settingsService } from "@/lib/service-client";
import { revalidatePath } from "next/cache";

export interface NotificationSettings {
  newVideos?: boolean;
  liveStreams?: boolean;
  comments?: boolean;
  replies?: boolean;
  likes?: boolean;
  subscribers?: boolean;
  mentions?: boolean;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
}

/**
 * Get notification settings
 */
export async function getNotificationSettings() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await settingsService.getNotifications();
  return {
    success: result.success,
    data: result.data,
    error: result.error?.message,
  };
}

/**
 * Update notification settings
 */
export async function updateNotificationSettings(settings: NotificationSettings) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await settingsService.updateNotifications(settings);

  if (result.success) {
    revalidatePath("/settings/notifications");
  }

  return {
    success: result.success,
    data: result.data,
    error: result.error?.message,
  };
}
