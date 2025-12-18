// Credential registration - stores in Redis pending verification
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { setPendingRegistration } from "@/lib/redis";
import { sendVerificationEmail } from "@/lib/email";
import type { ApiResponse } from "@repo/common";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Email and password required" } },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid email format" } },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Password must be at least 8 characters" } },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "DUPLICATE_EMAIL", message: "Email already registered" } },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate verification token
    const token = uuid();

    // Store in Redis (24h TTL)
    await setPendingRegistration(token, { email, passwordHash });

    // Send verification email
    await sendVerificationEmail(email, token);

    return NextResponse.json<ApiResponse<{ message: string }>>({
      success: true,
      data: { message: "Verification email sent. Please check your inbox." },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Registration failed" } },
      { status: 500 }
    );
  }
}
