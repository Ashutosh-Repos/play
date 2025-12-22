"use server";

import { auth } from "@/lib/auth";
import { profileService } from "@/lib/service-client";
import { revalidatePath } from "next/cache";

export interface ProfileUpdate {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

/**
 * Get current user's profile
 */
export async function getProfile() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await profileService.getMe();
  return {
    success: result.success,
    data: result.data,
    error: result.error?.message,
  };
}

/**
 * Update user profile
 */
export async function updateProfile(data: ProfileUpdate) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await profileService.update(data);

  if (result.success) {
    revalidatePath("/settings/profile");
    revalidatePath(`/u/${session.user.username}`);
  }

  return {
    success: result.success,
    data: result.data,
    error: result.error?.message,
  };
}

/**
 * Get public profile by user ID
 */
export async function getPublicProfile(userId: string) {
  const result = await profileService.get(userId);
  return {
    success: result.success,
    data: result.data,
    error: result.error?.message,
  };
}

/**
 * Get public profile by username
 */
export async function getProfileByUsername(username: string) {
  const result = await profileService.getByUsername(username);
  return {
    success: result.success,
    data: result.data,
    error: result.error?.message,
  };
}
