// Forgot password route - sends reset email
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { v4 as uuid } from "uuid";
import { sendPasswordResetEmail } from "@/lib/email";
import type { ApiResponse } from "@repo/common";

const RESET_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Email required" } },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json<ApiResponse<{ message: string }>>({
        success: true,
        data: { message: "If the email exists, a reset link has been sent." },
      });
    }

    // Generate token
    const token = uuid();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY);

    // Create reset token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Send email
    await sendPasswordResetEmail(email, token);

    return NextResponse.json<ApiResponse<{ message: string }>>({
      success: true,
      data: { message: "If the email exists, a reset link has been sent." },
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to process request" } },
      { status: 500 }
    );
  }
}
