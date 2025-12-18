// Reset password route - validates token and updates password
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import bcrypt from "bcryptjs";
import { revokeAllUserTokens } from "@/lib/tokens";
import type { ApiResponse } from "@repo/common";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Token and new password required" } },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Password must be at least 8 characters" } },
        { status: 400 }
      );
    }

    // Find token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "INVALID_TOKEN", message: "Invalid or expired reset link" } },
        { status: 400 }
      );
    }

    // Check if expired
    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "TOKEN_EXPIRED", message: "Reset link has expired" } },
        { status: 400 }
      );
    }

    // Check if already used
    if (resetToken.usedAt) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "TOKEN_USED", message: "Reset link has already been used" } },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Revoke all refresh tokens for security
    await revokeAllUserTokens(resetToken.userId);

    return NextResponse.json<ApiResponse<{ message: string }>>({
      success: true,
      data: { message: "Password reset successfully. Please log in with your new password." },
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to reset password" } },
      { status: 500 }
    );
  }
}
