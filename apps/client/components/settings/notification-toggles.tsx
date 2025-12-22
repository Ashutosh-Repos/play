"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { updateNotificationSettings } from "@/app/actions/settings";

interface NotificationSettings {
  newVideos: boolean;
  liveStreams: boolean;
  comments: boolean;
  replies: boolean;
  likes: boolean;
  subscribers: boolean;
  mentions: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
}

interface NotificationTogglesProps {
  settings: NotificationSettings;
}

const settingGroups = [
  {
    title: "Content",
    description: "Notifications about channels you follow",
    items: [
      { key: "newVideos", label: "New video uploads", description: "When subscribed channels post new videos" },
      { key: "liveStreams", label: "Live streams", description: "When channels you follow go live" },
    ],
  },
  {
    title: "Engagement",
    description: "Activity on your content",
    items: [
      { key: "comments", label: "Comments", description: "When someone comments on your videos" },
      { key: "replies", label: "Replies", description: "When someone replies to your comments" },
      { key: "likes", label: "Likes", description: "When someone likes your content" },
      { key: "mentions", label: "Mentions", description: "When you're mentioned in comments" },
    ],
  },
  {
    title: "Channel",
    description: "Your channel activity",
    items: [
      { key: "subscribers", label: "New subscribers", description: "When someone subscribes to your channel" },
    ],
  },
];

export function NotificationToggles({ settings }: NotificationTogglesProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function updateSetting(key: string, value: boolean) {
    startTransition(async () => {
      const result = await updateNotificationSettings({ [key]: value });
      if (result.success) {
        toast.success("Preferences saved");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to save preferences");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Delivery Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Methods</CardTitle>
          <CardDescription>How you want to receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pushEnabled">Push notifications</Label>
              <p className="text-xs text-muted-foreground">
                Receive notifications in your browser
              </p>
            </div>
            <Switch
              id="pushEnabled"
              checked={settings.pushEnabled}
              onCheckedChange={(checked) => updateSetting("pushEnabled", checked)}
              disabled={isPending}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailEnabled">Email notifications</Label>
              <p className="text-xs text-muted-foreground">
                Get important updates via email
              </p>
            </div>
            <Switch
              id="emailEnabled"
              checked={settings.emailEnabled}
              onCheckedChange={(checked) => updateSetting("emailEnabled", checked)}
              disabled={isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      {settingGroups.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
            <CardDescription>{group.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.items.map((item, index) => (
              <div key={item.key}>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor={item.key}>{item.label}</Label>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch
                    id={item.key}
                    checked={settings[item.key as keyof NotificationSettings] as boolean}
                    onCheckedChange={(checked) => updateSetting(item.key, checked)}
                    disabled={isPending}
                  />
                </div>
                {index < group.items.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
