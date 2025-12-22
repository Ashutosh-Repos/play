import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const { provider } = await params;
  const validProviders = ["google", "github", "discord"];

  if (!validProviders.includes(provider.toLowerCase())) {
    return NextResponse.json(
      { error: { message: `Invalid provider. Must be one of: ${validProviders.join(", ")}` } },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { identities: true },
    });

    if (!user) {
      return NextResponse.json({ error: { message: "User not found" } }, { status: 404 });
    }

    // Prevent unlinking if no password and only one connection
    if (!user.passwordHash && user.identities.length <= 1) {
      return NextResponse.json(
        { error: { message: "Cannot remove last login method. Set a password first." } },
        { status: 400 }
      );
    }

    const connection = user.identities.find(
      (i) => i.provider.toLowerCase() === provider.toLowerCase()
    );

    if (!connection) {
      return NextResponse.json({ error: { message: "Connection not found" } }, { status: 404 });
    }

    await prisma.oAuthIdentity.delete({ where: { id: connection.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unlink connection error:", error);
    return NextResponse.json({ error: { message: "Failed to unlink connection" } }, { status: 500 });
  }
}
