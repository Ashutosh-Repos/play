// Complete registration - create user with username
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getPendingRegistration, deletePendingRegistration } from "@/lib/redis";
import { usernameExists, addUsername } from "@/lib/bloomFilter";
import type { ApiResponse } from "@repo/common";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, username } = body;

    if (!token || !username) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Token and username required" } },
        { status: 400 }
      );
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Username must be 3-30 alphanumeric characters or underscores" } },
        { status: 400 }
      );
    }

    // Get pending registration from Redis
    const pending = await getPendingRegistration(token);
    if (!pending) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "TOKEN_EXPIRED", message: "Registration link expired. Please register again." } },
        { status: 400 }
      );
    }

    // Check username availability
    const mightExist = await usernameExists(username);
    if (mightExist) {
      // Confirm with database
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: { code: "DUPLICATE_USERNAME", message: "Username already taken" } },
          { status: 400 }
        );
      }
    }

    // Check email not taken (race condition protection)
    const existingEmail = await prisma.user.findUnique({ where: { email: pending.email } });
    if (existingEmail) {
      await deletePendingRegistration(token);
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "DUPLICATE_EMAIL", message: "Email already registered" } },
        { status: 400 }
      );
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email: pending.email,
        username,
        displayName: username, // Default to username, can change later
        passwordHash: pending.passwordHash,
        emailVerified: true,
      },
    });

    // Add username to bloom filter
    await addUsername(username);

    // Delete pending registration
    await deletePendingRegistration(token);

    return NextResponse.json<ApiResponse<{ message: string }>>({
      success: true,
      data: { message: "Registration complete. You can now log in." },
    });
  } catch (error) {
    console.error("Complete registration error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Registration failed" } },
      { status: 500 }
    );
  }
}
