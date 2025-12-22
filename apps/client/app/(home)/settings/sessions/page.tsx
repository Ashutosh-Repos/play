import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { SessionList } from "@/components/settings/session-list";
import { OAuthConnections } from "@/components/settings/oauth-connections";
import { Separator } from "@/components/ui/separator";

export default async function SessionsPage() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  // Get active sessions
  const sessions = await prisma.refreshToken.findMany({
    where: {
      userId: session.user.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Get OAuth connections
  const connections = await prisma.oAuthIdentity.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      provider: true,
      createdAt: true,
    },
  });

  // Check if user has password (to determine if they can unlink OAuth)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  const hasPassword = !!user?.passwordHash;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sessions & Connections</h1>
        <p className="text-muted-foreground">
          Manage your active devices and linked accounts.
        </p>
      </div>

      {/* Active Sessions */}
      <SessionList sessions={sessions} currentSessionId={session.user.sessionId} />

      <Separator />

      {/* OAuth Connections */}
      <OAuthConnections
        connections={connections}
        hasPassword={hasPassword}
      />
    </div>
  );
}
