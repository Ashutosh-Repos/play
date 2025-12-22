"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { subscribe, unsubscribe } from "@/app/actions/user";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { IconLoader2, IconBell, IconBellOff } from "@tabler/icons-react";

interface SubscribeButtonProps {
  channelId: string;
  isSubscribed: boolean;
  subscriberCount: number;
}

export function SubscribeButton({ channelId, isSubscribed, subscriberCount }: SubscribeButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleClick() {
    startTransition(async () => {
      if (isSubscribed) {
        const result = await unsubscribe(channelId);
        if (result.success) {
          toast.success("Unsubscribed");
          router.refresh();
        } else {
          toast.error(result.error || "Failed to unsubscribe");
        }
      } else {
        const result = await subscribe(channelId);
        if (result.success) {
          toast.success("Subscribed!");
          router.refresh();
        } else {
          toast.error(result.error || "Failed to subscribe");
        }
      }
    });
  }

  if (isSubscribed) {
    return (
      <Button
        variant="secondary"
        onClick={handleClick}
        disabled={isPending}
        className="gap-2"
      >
        {isPending ? (
          <IconLoader2 className="h-4 w-4 animate-spin" />
        ) : (
          <IconBellOff className="h-4 w-4" />
        )}
        Subscribed
      </Button>
    );
  }

  return (
    <Button onClick={handleClick} disabled={isPending} className="gap-2">
      {isPending ? (
        <IconLoader2 className="h-4 w-4 animate-spin" />
      ) : (
        <IconBell className="h-4 w-4" />
      )}
      Subscribe
    </Button>
  );
}
