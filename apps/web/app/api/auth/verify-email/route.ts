// Verify email token route
import { NextRequest, NextResponse } from "next/server";
import { getPendingRegistration } from "@/lib/redis";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=InvalidToken", req.url));
  }

  // Check if pending registration exists
  const pending = await getPendingRegistration(token);

  if (!pending) {
    return NextResponse.redirect(new URL("/login?error=TokenExpired", req.url));
  }

  // Redirect to set-username page with token
  return NextResponse.redirect(new URL(`/set-username?token=${token}`, req.url));
}
