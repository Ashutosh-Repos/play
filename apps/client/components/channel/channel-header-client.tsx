"use client";

import { ChannelHeader } from "./channel-header";
import { toggleSubscription } from "@/app/actions/subscription";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Channel {
  id: string;
  handle: string;
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isVerified: boolean;
  subscriberCount: number;
  videoCount: number;
}

interface ChannelHeaderClientProps {
  channel: Channel;
  isSubscribed: boolean;
  isOwnChannel: boolean;
  isAuthenticated: boolean;
}

export function ChannelHeaderClient({
  channel,
  isSubscribed,
  isOwnChannel,
  isAuthenticated,
}: ChannelHeaderClientProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubscribe() {
    startTransition(async () => {
      const result = await toggleSubscription(channel.id, isSubscribed);
      if (result.success) {
        toast.success(isSubscribed ? "Unsubscribed" : "Subscribed!");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update subscription");
      }
    });
  }

  return (
    <ChannelHeader
      channel={channel}
      isSubscribed={isSubscribed}
      isOwnChannel={isOwnChannel}
      isAuthenticated={isAuthenticated}
      onSubscribe={isAuthenticated && !isOwnChannel ? handleSubscribe : undefined}
    />
  );
}
