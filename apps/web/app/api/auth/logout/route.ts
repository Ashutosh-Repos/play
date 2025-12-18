// Logout route - revokes all refresh tokens
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { revokeAllUserTokens } from "@/lib/tokens";
import type { ApiResponse } from "@repo/common";

const REFRESH_COOKIE = "play_refresh_token";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (session?.user?.id) {
      // Revoke all refresh tokens for this user
      await revokeAllUserTokens(session.user.id);
    }

    // Clear refresh token cookie
    const cookieStore = await cookies();
    cookieStore.delete(REFRESH_COOKIE);

    return NextResponse.json<ApiResponse<{ message: string }>>({
      success: true,
      data: { message: "Logged out successfully" },
    });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Logout failed" } },
      { status: 500 }
    );
  }
}
