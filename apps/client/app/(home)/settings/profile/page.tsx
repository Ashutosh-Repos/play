import { auth } from "@/lib/auth";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    return null; // Layout handles redirect
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your public profile information.
        </p>
      </div>

      <ProfileForm
        defaultValues={{
          displayName: session.user.displayName || "",
          bio: (session.user as any).bio || "",
          avatarUrl: session.user.avatarUrl || "",
        }}
      />
    </div>
  );
}
