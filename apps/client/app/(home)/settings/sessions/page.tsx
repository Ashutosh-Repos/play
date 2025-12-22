import { auth } from "@/lib/auth";
import { accountService } from "@/lib/service-client";
import { SessionList } from "@/components/settings/session-list";
import { OAuthConnections } from "@/components/settings/oauth-connections";
import { Separator } from "@/components/ui/separator";

export default async function SessionsPage() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  // Pass sessionId for x-token-id header to mark current session
  const [sessionsResult, connectionsResult, infoResult] = await Promise.all([
    accountService.getSessions(session.user.sessionId ?? undefined),
    accountService.getConnections(),
    accountService.getInfo(),
  ]);

  const sessions = sessionsResult.success && sessionsResult.data 
    ? sessionsResult.data.map(s => ({
        id: s.id,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: new Date(s.createdAt),
        expiresAt: new Date(s.expiresAt),
        current: s.current,
      }))
    : [];

  const connections = connectionsResult.success && connectionsResult.data
    ? connectionsResult.data.map(c => ({
        id: c.id,
        provider: c.provider,
        createdAt: new Date(c.createdAt),
      }))
    : [];

  // Get hasPassword from account info endpoint
  const hasPassword = infoResult.success && infoResult.data
    ? infoResult.data.hasPassword
    : false;

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
