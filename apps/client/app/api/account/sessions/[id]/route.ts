import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const { id } = await params;

  try {
    const token = await prisma.refreshToken.findFirst({
      where: { id, userId: session.user.id, revokedAt: null },
    });

    if (!token) {
      return NextResponse.json({ error: { message: "Session not found" } }, { status: 404 });
    }

    await prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke session error:", error);
    return NextResponse.json({ error: { message: "Failed to revoke session" } }, { status: 500 });
  }
}
