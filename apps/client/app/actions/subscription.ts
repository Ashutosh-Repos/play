"use server";

import { auth } from "@/lib/auth";
import { subscriptionService } from "@/lib/service-client";
import { revalidatePath } from "next/cache";

/**
 * Subscribe to a channel
 */
export async function subscribe(channelId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await subscriptionService.subscribe(channelId);

  if (result.success) {
    // Revalidate all channel pages - dynamic routes require layout revalidation
    revalidatePath("/channel", "layout");
  }

  return {
    success: result.success,
    error: result.error?.message,
  };
}

/**
 * Unsubscribe from a channel
 */
export async function unsubscribe(channelId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await subscriptionService.unsubscribe(channelId);

  if (result.success) {
    // Revalidate all channel pages - dynamic routes require layout revalidation
    revalidatePath("/channel", "layout");
  }

  return {
    success: result.success,
    error: result.error?.message,
  };
}

/**
 * Toggle subscription (subscribe if not subscribed, unsubscribe if subscribed)
 */
export async function toggleSubscription(channelId: string, isCurrentlySubscribed: boolean) {
  if (isCurrentlySubscribed) {
    return unsubscribe(channelId);
  } else {
    return subscribe(channelId);
  }
}

/**
 * Update subscription notification level
 */
export async function updateSubscriptionNotification(
  channelId: string,
  notificationLevel: "ALL" | "PERSONALIZED" | "NONE"
) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await subscriptionService.updateNotification(channelId, notificationLevel);

  return {
    success: result.success,
    error: result.error?.message,
  };
}
