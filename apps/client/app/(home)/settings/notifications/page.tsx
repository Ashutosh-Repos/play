import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { NotificationToggles } from "@/components/settings/notification-toggles";

export default async function NotificationsPage() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  // Get or create notification settings
  let settings = await prisma.notificationSettings.findUnique({
    where: { userId: session.user.id },
  });

  if (!settings) {
    settings = await prisma.notificationSettings.create({
      data: { userId: session.user.id },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Choose what notifications you want to receive.
        </p>
      </div>

      <NotificationToggles
        settings={{
          newVideos: settings.newVideos,
          liveStreams: settings.liveStreams,
          comments: settings.comments,
          replies: settings.replies,
          likes: settings.likes,
          subscribers: settings.subscribers,
          mentions: settings.mentions,
          emailEnabled: settings.emailEnabled,
          pushEnabled: settings.pushEnabled,
        }}
      />
    </div>
  );
}
