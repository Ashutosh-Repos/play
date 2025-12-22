import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { CreateChannelForm } from "@/components/settings/create-channel-form";
import { ChannelForm } from "@/components/settings/channel-form";

export default async function ChannelSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  const channel = await prisma.channel.findUnique({
    where: { userId: session.user.id, deletedAt: null },
    select: {
      id: true,
      handle: true,
      displayName: true,
      description: true,
      avatarUrl: true,
      bannerUrl: true,
      location: true,
      contactEmail: true,
      links: true,
      subscriberCount: true,
      videoCount: true,
    },
  });

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
