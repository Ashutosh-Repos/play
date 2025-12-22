"use server";

import { auth } from "@/lib/auth";
import { accountService } from "@/lib/service-client";
import { revalidatePath } from "next/cache";

// =============================================================================
// Session Management
// =============================================================================

/**
 * Get all active sessions for current user
 */
export async function getSessions() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await accountService.getSessions();
  return {
    success: result.success,
    data: result.data,
    error: result.error?.message,
  };
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await accountService.revokeSession(sessionId);

  if (result.success) {
    revalidatePath("/settings/sessions");
  }

  return {
    success: result.success,
    error: result.error?.message,
  };
}

/**
 * Revoke all sessions except current
 */
export async function revokeOtherSessions() {
  const session = await auth();
  if (!session?.user?.id || !session.user.sessionId) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await accountService.revokeOtherSessions(session.user.sessionId);

  if (result.success) {
    revalidatePath("/settings/sessions");
  }

  return {
    success: result.success,
    error: result.error?.message,
  };
}

// =============================================================================
// OAuth Connections
// =============================================================================

/**
 * Get all OAuth connections for current user
 */
export async function getConnections() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await accountService.getConnections();
  return {
    success: result.success,
    data: result.data,
    error: result.error?.message,
  };
}

/**
 * Unlink an OAuth provider
 */
export async function unlinkConnection(provider: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await accountService.unlinkConnection(provider);

  if (result.success) {
    revalidatePath("/settings/account");
  }

  return {
    success: result.success,
    error: result.error?.message,
  };
}

// =============================================================================
// Password Management
// =============================================================================

/**
 * Set password for OAuth-only users
 */
export async function setPassword(password: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  if (!password || password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  const result = await accountService.setPassword(password);

  return {
    success: result.success,
    error: result.error?.message,
  };
}

/**
 * Change password (requires current password)
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  if (!currentPassword || !newPassword) {
    return { success: false, error: "Both passwords are required" };
  }

  if (newPassword.length < 8) {
    return { success: false, error: "New password must be at least 8 characters" };
  }

  const result = await accountService.changePassword(currentPassword, newPassword);

  return {
    success: result.success,
    error: result.error?.message,
  };
}

// =============================================================================
// Account Deletion
// =============================================================================

/**
 * Request account deletion (30-day grace period)
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

/**
 * Cancel account deletion (within grace period)
 */
export async function restoreAccount() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await accountService.restoreAccount();

  return {
    success: result.success,
    data: result.data,
    error: result.error?.message,
  };
}
