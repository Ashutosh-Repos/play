"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";

const updateProfileSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(50, "Max 50 characters"),
  bio: z.string().max(500, "Max 500 characters").optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export async function updateProfile(data: UpdateProfileInput) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = updateProfileSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        displayName: parsed.data.displayName,
        bio: parsed.data.bio || null,
        avatarUrl: parsed.data.avatarUrl || null,
      },
    });

    revalidatePath("/settings/profile");
    return { success: true };
  } catch (error) {
    console.error("Update profile error:", error);
    return { success: false, error: "Failed to update profile" };
  }
}

const updateUsernameSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
});

export async function updateUsername(data: { username: string }) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = updateUsernameSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const username = parsed.data.username.toLowerCase();

  try {
    // Check rate limit (30 days)
    const recentChange = await prisma.auditLog.findFirst({
      where: {
        targetUserId: session.user.id,
        action: "USERNAME_CHANGE",
        createdAt: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    if (recentChange) {
      const nextAllowed = new Date(recentChange.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      return {
        success: false,
        error: `Username can only be changed once every 30 days. Next change: ${nextAllowed.toLocaleDateString()}`,
      };
    }

    // Check if taken
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== session.user.id) {
      return { success: false, error: "Username already taken" };
    }

    // Update with audit log
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { username },
      }),
      prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          targetUserId: session.user.id,
          action: "USERNAME_CHANGE",
          resource: "USER",
          resourceId: session.user.id,
          metadata: { oldUsername: session.user.username, newUsername: username },
        },
      }),
    ]);

    revalidatePath("/settings/account");
    return { success: true };
  } catch (error) {
    console.error("Update username error:", error);
    return { success: false, error: "Failed to update username" };
  }
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function changePassword(data: { currentPassword: string; newPassword: string }) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = changePasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return { success: false, error: "No password set. Use 'Set Password' instead." };
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return { success: false, error: "Current password is incorrect" };
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newHash },
    });

    return { success: true };
  } catch (error) {
    console.error("Change password error:", error);
    return { success: false, error: "Failed to change password" };
  }
}

export async function deleteAccount(password?: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true, deletedAt: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (user.deletedAt) {
      return { success: false, error: "Account already scheduled for deletion" };
    }

    // Verify password if user has one
    if (user.passwordHash) {
      if (!password) {
        return { success: false, error: "Password required" };
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return { success: false, error: "Incorrect password" };
      }
    }

    // Soft delete
    await prisma.user.update({
      where: { id: session.user.id },
      data: { deletedAt: new Date() },
    });

    // Revoke all sessions
    await prisma.refreshToken.updateMany({
      where: { userId: session.user.id },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    console.error("Delete account error:", error);
    return { success: false, error: "Failed to delete account" };
  }
}

const setPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function setPassword(data: { password: string }) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = setPasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (user?.passwordHash) {
      return { success: false, error: "Password already set. Use 'Change Password' instead." };
    }

    const hash = await bcrypt.hash(parsed.data.password, 12);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: hash },
    });

    revalidatePath("/settings/account");
    return { success: true };
  } catch (error) {
    console.error("Set password error:", error);
    return { success: false, error: "Failed to set password" };
  }
}

export async function subscribe(channelId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Check if already subscribed
    const existing = await prisma.subscription.findUnique({
      where: {
        subscriberId_channelId: {
          subscriberId: session.user.id,
          channelId,
        },
      },
    });

    if (existing) {
      return { success: false, error: "Already subscribed" };
    }

    // Create subscription and increment count in transaction
    await prisma.$transaction([
      prisma.subscription.create({
        data: {
          subscriberId: session.user.id,
          channelId,
        },
      }),
      prisma.channel.update({
        where: { id: channelId },
        data: { subscriberCount: { increment: 1 } },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("Subscribe error:", error);
    return { success: false, error: "Failed to subscribe" };
  }
}

export async function unsubscribe(channelId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const existing = await prisma.subscription.findUnique({
      where: {
        subscriberId_channelId: {
          subscriberId: session.user.id,
          channelId,
        },
      },
    });

    if (!existing) {
      return { success: false, error: "Not subscribed" };
    }

    // Delete subscription and decrement count in transaction
    await prisma.$transaction([
      prisma.subscription.delete({
        where: { id: existing.id },
      }),
      prisma.channel.update({
        where: { id: channelId },
        data: { subscriberCount: { decrement: 1 } },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return { success: false, error: "Failed to unsubscribe" };
  }
}
