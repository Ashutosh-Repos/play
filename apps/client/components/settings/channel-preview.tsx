"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconCheck, IconUsers, IconVideo, IconEye } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface ChannelPreviewProps {
  displayName: string;
  handle: string;
  description?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  subscriberCount?: number;
  videoCount?: number;
  isVerified?: boolean;
  className?: string;
}

function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

export function ChannelPreview({
  displayName,
  handle,
  description,
  avatarUrl,
  bannerUrl,
  subscriberCount = 0,
  videoCount = 0,
  isVerified = false,
  className,
}: ChannelPreviewProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <IconEye className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Live Preview</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Mini banner */}
        <div className="relative h-20 bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 overflow-hidden">
          {bannerUrl && (
            <img
              src={bannerUrl}
              alt="Banner preview"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>

        {/* Profile info */}
        <div className="px-4 pb-4 -mt-8 relative">
          <Avatar className="h-16 w-16 ring-2 ring-background shadow-lg">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="text-lg bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
              {displayName?.charAt(0)?.toUpperCase() || "C"}
            </AvatarFallback>
          </Avatar>

          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">
                {displayName || "Channel Name"}
              </h3>
              {isVerified && (
                <Badge variant="secondary" className="gap-0.5 text-xs h-5">
                  <IconCheck className="h-3 w-3" />
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              @{handle || "handle"}
            </p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <IconUsers className="h-3.5 w-3.5" />
                {formatCount(subscriberCount)}
              </span>
              <span className="flex items-center gap-1">
                <IconVideo className="h-3.5 w-3.5" />
                {videoCount}
              </span>
            </div>

            {description && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                {description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
