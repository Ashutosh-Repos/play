"use server";

import { auth } from "@/lib/auth";
import { profileService, accountService } from "@/lib/service-client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateProfileSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(50, "Max 50 characters"),
  bio: z.string().max(500, "Max 500 characters").optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Update user profile using user-service
 */
export async function updateProfile(data: UpdateProfileInput) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = updateProfileSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  // Use service instead of direct Prisma
  const result = await profileService.update({
    displayName: parsed.data.displayName,
    bio: parsed.data.bio,
    avatarUrl: parsed.data.avatarUrl || undefined,
  });

  if (result.success) {
    revalidatePath("/settings/profile");
  }

  return {
    success: result.success,
    error: result.error?.message,
  };
}

const updateUsernameSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
});

/**
 * Change username using user-service (rate limited to once per 30 days)
 */
export async function updateUsername(data: { username: string }) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = updateUsernameSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  // Use accountService for username change
  const result = await accountService.changeUsername(parsed.data.username);

  if (result.success) {
    revalidatePath("/settings/account");
  }

  return {
    success: result.success,
    error: result.error?.message,
  };
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Change password using user-service
 */
export async function changePassword(data: { currentPassword: string; newPassword: string }) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = changePasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const result = await accountService.changePassword(
    parsed.data.currentPassword,
    parsed.data.newPassword
  );

  return {
    success: result.success,
    error: result.error?.message,
  };
}

/**
 * Delete account using user-service
 */
export async function deleteAccount(password?: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await accountService.deleteAccount(password);

  return {
    success: result.success,
    data: result.data,
    error: result.error?.message,
  };
}

const setPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Set password for OAuth users using user-service
 */
export async function setPassword(data: { password: string }) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = setPasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const result = await accountService.setPassword(parsed.data.password);

  if (result.success) {
    revalidatePath("/settings/account");
  }

  return {
    success: result.success,
    error: result.error?.message,
  };
}
