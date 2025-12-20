import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChannelHeaderProps {
  channel: {
    id: string;
    handle: string;
    displayName: string;
    description: string | null;
    bannerUrl: string | null;
    subscriberCount: number;
    user: {
      avatarUrl: string | null;
      displayName: string;
    };
    _count: {
      videos: number;
    };
  };
  isOwner: boolean;
  isSubscribed: boolean;
  subscribeButton?: React.ReactNode;
}

function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export function ChannelHeader({
  channel,
  isOwner,
  subscribeButton,
}: ChannelHeaderProps) {
  const initials = channel.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="w-full">
      {/* Banner */}
      <div className="relative w-full h-32 sm:h-48 md:h-56 bg-gradient-to-r from-primary/20 to-primary/5 rounded-xl overflow-hidden">
        {channel.bannerUrl && (
          <Image
            src={channel.bannerUrl}
            alt={`${channel.displayName} banner`}
            fill
            className="object-cover"
          />
        )}
      </div>

      {/* Profile section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-4 -mt-8 sm:-mt-12">
        {/* Avatar */}
        <Avatar className="w-20 h-20 sm:w-32 sm:h-32 border-4 border-background shadow-lg">
          <AvatarImage src={channel.user.avatarUrl || undefined} />
          <AvatarFallback className="text-2xl sm:text-4xl bg-primary text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 pt-2 sm:pt-8">
          <h1 className="text-xl sm:text-2xl font-bold">{channel.displayName}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
            <span>@{channel.handle}</span>
            <span>•</span>
            <span>{formatCount(channel.subscriberCount)} subscribers</span>
            <span>•</span>
            <span>{channel._count.videos} videos</span>
          </div>
          {channel.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2 max-w-2xl">
              {channel.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:pt-8">
          {!isOwner && subscribeButton}
          {isOwner && (
            <a
              href="/studio"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2"
            >
              Manage Channel
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
