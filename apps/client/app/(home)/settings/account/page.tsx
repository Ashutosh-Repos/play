import { auth } from "@/lib/auth";
import { accountService } from "@/lib/service-client";
import { UsernameForm } from "@/components/settings/username-form";
import { PasswordForm } from "@/components/settings/password-form";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";
import { Separator } from "@/components/ui/separator";

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  // Use service endpoint for account info
  const result = await accountService.getInfo();

  const hasPassword = result.success && result.data
    ? result.data.hasPassword
    : false;
  
  const username = result.success && result.data
    ? result.data.username
    : session.user.username || "";

  const cooldownUntil = result.success && result.data?.usernameCooldownUntil
    ? new Date(result.data.usernameCooldownUntil)
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
        currentUsername={username}
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
