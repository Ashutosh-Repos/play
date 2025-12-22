import { auth } from "@/lib/auth";
import { settingsService } from "@/lib/service-client";
import { NotificationToggles } from "@/components/settings/notification-toggles";

export default async function NotificationsPage() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  // Use service instead of direct Prisma
  const result = await settingsService.getNotifications();
  
  // Default settings if service call fails
  const settings = result.success && result.data ? result.data : {
    newVideos: true,
    liveStreams: true,
    comments: true,
    replies: true,
    likes: true,
    subscribers: true,
    mentions: true,
    emailEnabled: true,
    pushEnabled: true,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Choose what notifications you want to receive.
        </p>
      </div>

      <NotificationToggles settings={settings} />
    </div>
  );
}
