"use client";

import { useState, useTransition, useOptimistic } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IconBell, IconBellOff, IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";

interface SubscribeButtonProps {
  channelId: string;
  channelHandle: string;
  initialSubscribed: boolean;
  initialCount: number;
}

export function SubscribeButton({
  channelHandle,
  initialSubscribed,
  initialCount,
}: SubscribeButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [optimisticState, setOptimisticState] = useOptimistic(
    { subscribed: initialSubscribed, count: initialCount },
    (state, newSubscribed: boolean) => ({
      subscribed: newSubscribed,
      count: state.count + (newSubscribed ? 1 : -1),
    })
  );

  const handleClick = () => {
    if (!session) {
      router.push("/login");
      return;
    }

    const newSubscribed = !optimisticState.subscribed;

    startTransition(async () => {
      // Optimistic update
      setOptimisticState(newSubscribed);

      try {
        const res = await fetch(`/api/channels/${channelHandle}/subscribe`, {
          method: newSubscribed ? "POST" : "DELETE",
        });

        const data = await res.json();

        if (!data.success) {
          // Revert on error
          setOptimisticState(!newSubscribed);
          toast.error(data.error?.message || "Failed to update subscription");
        }
      } catch {
        // Revert on error
        setOptimisticState(!newSubscribed);
        toast.error("Something went wrong");
      }
    });
  };

  return (
    <Button
      onClick={handleClick}
      variant={optimisticState.subscribed ? "outline" : "default"}
      disabled={isPending}
      className="gap-2"
    >
      {isPending ? (
        <IconLoader2 className="w-4 h-4 animate-spin" />
      ) : optimisticState.subscribed ? (
        <IconBellOff className="w-4 h-4" />
      ) : (
        <IconBell className="w-4 h-4" />
      )}
      {optimisticState.subscribed ? "Subscribed" : "Subscribe"}
    </Button>
  );
}
