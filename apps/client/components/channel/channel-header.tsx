"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCheck, IconUsers, IconVideo, IconBell, IconBellFilled } from "@tabler/icons-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

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

interface ChannelHeaderProps {
  channel: Channel;
  isSubscribed: boolean;
  isOwnChannel: boolean;
  isAuthenticated: boolean;
  onSubscribe?: () => void;
}

function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

export function ChannelHeader({
  channel,
  isSubscribed,
  isOwnChannel,
  isAuthenticated,
  onSubscribe,
}: ChannelHeaderProps) {
  return (
    <div className="animate-in fade-in duration-500">
      {/* Banner */}
      <div className="relative w-full h-32 sm:h-40 md:h-48 lg:h-56 rounded-xl overflow-hidden">
        {channel.bannerUrl ? (
          <Image
            src={channel.bannerUrl}
            alt={`${channel.displayName} banner`}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20">
            <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />
          </div>
        )}
      </div>

      {/* Channel Info */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center px-4 py-4">
        {/* Avatar */}
        <Avatar className="h-20 w-20 sm:h-28 sm:w-28 ring-4 ring-background shadow-xl -mt-12 sm:-mt-16 animate-in zoom-in duration-300">
          <AvatarImage src={channel.avatarUrl || undefined} />
          <AvatarFallback className="text-2xl sm:text-4xl bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
            {channel.displayName?.charAt(0)?.toUpperCase() || "C"}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 space-y-1 animate-in slide-in-from-left duration-300 delay-100">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
              {channel.displayName}
            </h1>
            {channel.isVerified && (
              <Badge className="gap-1 bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20">
                <IconCheck className="h-3 w-3" />
                Verified
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span className="font-medium">@{channel.handle}</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              <IconUsers className="h-4 w-4" />
              {formatCount(channel.subscriberCount)} subscribers
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <IconVideo className="h-4 w-4" />
              {channel.videoCount} videos
            </span>
          </div>

          {channel.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 max-w-2xl">
              {channel.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 animate-in slide-in-from-right duration-300 delay-150">
          {isOwnChannel ? (
            <Button variant="outline" asChild>
              <a href="/settings/channel">Customize channel</a>
            </Button>
          ) : (
            <>
              {onSubscribe && (
                <Button
                  onClick={onSubscribe}
                  variant={isSubscribed ? "secondary" : "default"}
                  className={cn(
                    "min-w-[120px] transition-all",
                    isSubscribed && "bg-secondary hover:bg-secondary/80"
                  )}
                >
                  {isSubscribed ? "Subscribed" : "Subscribe"}
                </Button>
              )}
              {isSubscribed && onSubscribe && (
                <Button variant="ghost" size="icon">
                  <IconBellFilled className="h-5 w-5" />
                </Button>
              )}
              {!isAuthenticated && !onSubscribe && (
                <Button asChild>
                  <a href="/login">Sign in to Subscribe</a>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
