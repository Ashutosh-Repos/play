// Refresh token endpoint
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  rotateRefreshToken,
  generateAccessToken,
} from "@/lib/tokens";

const REFRESH_COOKIE = "play_refresh_token";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 days
};

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: { code: "NO_TOKEN", message: "No refresh token" } },
        { status: 401 }
      );
    }

    const userAgent = req.headers.get("user-agent") || undefined;
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || undefined;

    // Rotate token
    const result = await rotateRefreshToken(refreshToken, userAgent, ipAddress);

    if (!result) {
      // Clear invalid cookie
      const response = NextResponse.json(
        { success: false, error: { code: "INVALID_TOKEN", message: "Invalid or expired token" } },
        { status: 401 }
      );
      response.cookies.delete(REFRESH_COOKIE);
      return response;
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      sub: result.user.id,
      email: result.user.email,
      username: result.user.username,
      role: result.user.role,
      channelId: result.user.channelId,
    });

    // Set new refresh token cookie
    const response = NextResponse.json({
      success: true,
      data: { accessToken, user: result.user },
    });

    response.cookies.set(REFRESH_COOKIE, result.newRefreshToken, COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Refresh failed" } },
      { status: 500 }
    );
  }
}
