import { auth } from "@/lib/auth";
import { channelService } from "@/lib/service-client";
import { CreateChannelForm } from "@/components/settings/create-channel-form";
import { ChannelForm } from "@/components/settings/channel-form";

export default async function ChannelSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  // Use service instead of direct Prisma
  const result = await channelService.getMe();
  const channel = result.success ? result.data : null;

  // Parse links from JSON
  const links = channel?.links as { title: string; url: string }[] | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Channel</h1>
        <p className="text-muted-foreground">
          {channel ? "Manage your channel settings." : "Create a channel to start uploading videos."}
        </p>
      </div>

      {channel ? (
        <ChannelForm
          defaultValues={{
            handle: channel.handle,
            displayName: channel.displayName,
            description: channel.description || "",
            avatarUrl: channel.avatarUrl || "",
            bannerUrl: channel.bannerUrl || "",
            location: channel.location || "",
            contactEmail: channel.contactEmail || "",
            links: links || [],
          }}
        />
      ) : (
        <CreateChannelForm />
      )}
    </div>
  );
}
