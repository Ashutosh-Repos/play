"use client";

import { Button } from "@/components/ui/button";
import { IconBellFilled, IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { toggleSubscription } from "@/app/actions/subscription";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface SubscribeButtonProps {
  channelId: string;
  isSubscribed: boolean;
  isAuthenticated: boolean;
  isOwnChannel: boolean;
}

export function SubscribeButton({
  channelId,
  isSubscribed,
  isAuthenticated,
  isOwnChannel,
}: SubscribeButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (isOwnChannel) {
    return (
      <Button variant="outline" asChild>
        <a href="/settings/channel">Customize channel</a>
      </Button>
    );
  }

  if (!isAuthenticated) {
    return (
      <Button asChild>
        <a href="/login">Sign in to Subscribe</a>
      </Button>
    );
  }

  function handleClick() {
    startTransition(async () => {
      const result = await toggleSubscription(channelId, isSubscribed);
      if (result.success) {
        toast.success(isSubscribed ? "Unsubscribed" : "Subscribed!");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update subscription");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleClick}
        disabled={isPending}
        variant={isSubscribed ? "secondary" : "default"}
        className={cn(
          "min-w-[120px] transition-all",
          isSubscribed && "bg-secondary hover:bg-secondary/80"
        )}
      >
        {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubscribed ? "Subscribed" : "Subscribe"}
      </Button>
      {isSubscribed && (
        <Button variant="ghost" size="icon">
          <IconBellFilled className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
