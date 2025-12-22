import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  newVideos: z.boolean().optional(),
  liveStreams: z.boolean().optional(),
  comments: z.boolean().optional(),
  replies: z.boolean().optional(),
  likes: z.boolean().optional(),
  subscribers: z.boolean().optional(),
  mentions: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: parsed.error.issues[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const settings = await prisma.notificationSettings.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        ...parsed.data,
      },
      update: parsed.data,
    });

    return NextResponse.json({
      success: true,
      data: {
        newVideos: settings.newVideos,
        liveStreams: settings.liveStreams,
        comments: settings.comments,
        replies: settings.replies,
        likes: settings.likes,
        subscribers: settings.subscribers,
        mentions: settings.mentions,
        emailEnabled: settings.emailEnabled,
        pushEnabled: settings.pushEnabled,
      },
    });
  } catch (error) {
    console.error("Update notification settings error:", error);
    return NextResponse.json({ error: { message: "Failed to update settings" } }, { status: 500 });
  }
}
