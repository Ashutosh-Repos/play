// Set username for OAuth users or users changing username
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { auth } from "@/lib/auth";
import { usernameExists, addUsername } from "@/lib/bloomFilter";
import type { ApiResponse } from "@repo/common";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Username required" } },
        { status: 400 }
      );
    }

    // Validate format
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid username format" } },
        { status: 400 }
      );
    }

    // Check availability
    const mightExist = await usernameExists(username);
    if (mightExist) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== session.user.id) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: { code: "DUPLICATE_USERNAME", message: "Username already taken" } },
          { status: 400 }
        );
      }
    }

    // Update username
    await prisma.user.update({
      where: { id: session.user.id },
      data: { username },
    });

    // Add to bloom filter
    await addUsername(username);

    return NextResponse.json<ApiResponse<{ message: string }>>({
      success: true,
      data: { message: "Username updated" },
    });
  } catch (error) {
    console.error("Set username error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update username" } },
      { status: 500 }
    );
  }
}
