// Check username availability endpoint
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { usernameExists } from "@/lib/bloomFilter";
import { checkRateLimit } from "@/lib/redis";
import type { ApiResponse } from "@repo/common";

interface CheckUsernameResponse {
  available: boolean;
  suggestion?: string;
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");

  if (!username) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Username required" } },
      { status: 400 }
    );
  }

  // Validate format
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return NextResponse.json<ApiResponse<CheckUsernameResponse>>(
      { success: true, data: { available: false } },
      { status: 200 }
    );
  }

  try {
    // Rate Limit: 60 per minute per IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
    const rateLimit = await checkRateLimit(
      `check_username:${ip}`,
      60,
      60
    );

    if (!rateLimit.allowed) {
       return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "RATE_LIMIT", message: "Too many requests" } },
        { status: 429 }
      );
    }

    // Fast bloom filter check first
    const mightExist = await usernameExists(username);

    if (!mightExist) {
      // Definitely available
      return NextResponse.json<ApiResponse<CheckUsernameResponse>>({
        success: true,
        data: { available: true },
      });
    }

    // Bloom filter says might exist, confirm with database
    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existing) {
      // Generate suggestion
      const suggestion = `${username}${Math.floor(Math.random() * 1000)}`;
      return NextResponse.json<ApiResponse<CheckUsernameResponse>>({
        success: true,
        data: { available: false, suggestion },
      });
    }

    // False positive from bloom filter, actually available
    return NextResponse.json<ApiResponse<CheckUsernameResponse>>({
      success: true,
      data: { available: true },
    });
  } catch (error) {
    console.error("Check username error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Check failed" } },
      { status: 500 }
    );
  }
}
