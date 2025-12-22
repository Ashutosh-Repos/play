import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const handle = url.searchParams.get("handle");

    if (!handle || handle.length < 3) {
      return NextResponse.json({
        success: true,
        data: { available: null, message: "Handle must be at least 3 characters" },
      });
    }

    // Validate format
    if (!/^[a-zA-Z0-9_]+$/.test(handle)) {
      return NextResponse.json({
        success: true,
        data: { available: false, message: "Only letters, numbers, and underscores allowed" },
      });
    }

    // Check if handle exists (simple read query - OK to use Prisma directly)
    const existingChannel = await prisma.channel.findUnique({
      where: { handle: handle.toLowerCase() },
      select: { id: true },
    });

    if (!existingChannel) {
      return NextResponse.json({
        success: true,
        data: { available: true },
      });
    }

    // Handle is taken - generate suggestion
    const suggestion = `${handle}${Math.floor(Math.random() * 1000)}`;
    return NextResponse.json({
      success: true,
      data: { available: false, suggestion },
    });
  } catch (error) {
    console.error("Check handle error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
