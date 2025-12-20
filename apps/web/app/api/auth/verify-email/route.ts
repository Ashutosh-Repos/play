// Verify email token route and provision user
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { UserStatus } from "@repo/common";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=InvalidToken", req.url));
  }

  try {
    // 1. Find token in Postgres
    const existingToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!existingToken) {
      return NextResponse.redirect(new URL("/login?error=InvalidToken", req.url));
    }

    if (existingToken.expiresAt < new Date()) {
      return NextResponse.redirect(new URL("/login?error=TokenExpired", req.url));
    }

    // 2. Find user
    const user = await prisma.user.findUnique({
      where: { id: existingToken.userId },
    });

    if (!user) {
        return NextResponse.redirect(new URL("/login?error=UserNotFound", req.url));
    }

    if (user.emailVerified) {
        // Already verified
        await prisma.emailVerificationToken.delete({ where: { id: existingToken.id } });
        return NextResponse.redirect(new URL("/login?success=already_verified", req.url));
    }

    // 3. Mark user as verified
    await prisma.$transaction([
        prisma.user.update({
            where: { id: user.id },
            data: { 
                emailVerified: true,
                // Ensure status is at least PROVISIONED (it should be)
                status: user.status === UserStatus.SUSPENDED || user.status === UserStatus.BANNED 
                        ? user.status 
                        : UserStatus.PROVISIONED 
            },
        }),
        prisma.emailVerificationToken.delete({
            where: { id: existingToken.id },
        }),
    ]);

    // 4. Redirect to login
    return NextResponse.redirect(new URL("/login?success=verified", req.url));

  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.redirect(new URL("/login?error=VerificationFailed", req.url));
  }
}
