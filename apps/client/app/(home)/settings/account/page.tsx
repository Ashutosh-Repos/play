import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { UsernameForm } from "@/components/settings/username-form";
import { PasswordForm } from "@/components/settings/password-form";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";
import { Separator } from "@/components/ui/separator";

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  // Check if user has password
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, username: true },
  });

  const hasPassword = !!user?.passwordHash;

  // Check for rate limit on username change
  const recentUsernameChange = await prisma.auditLog.findFirst({
    where: {
      targetUserId: session.user.id,
      action: "USERNAME_CHANGE",
      createdAt: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });

  const cooldownUntil = recentUsernameChange
    ? new Date(recentUsernameChange.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          Manage your account security and preferences.
        </p>
      </div>

      {/* Username Section */}
      <UsernameForm
        currentUsername={user?.username || ""}
        cooldownUntil={cooldownUntil}
      />

      <Separator />

      {/* Password Section */}
      <PasswordForm hasPassword={hasPassword} />

      <Separator />

      {/* Danger Zone */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
          <p className="text-sm text-muted-foreground">
            Irreversible actions. Please be certain.
          </p>
        </div>
        <DeleteAccountDialog hasPassword={hasPassword} />
      </div>
    </div>
  );
}
