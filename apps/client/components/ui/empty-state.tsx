"use client";

import { cn } from "@/lib/utils";
import { Button } from "./button";
import Link from "next/link";
import {
  IconVideo,
  IconPlaylist,
  IconUsers,
  IconHistory,
  IconBell,
  IconSearch,
  IconFileOff,
  IconPlus,
} from "@tabler/icons-react";

type EmptyStateType =
  | "videos"
  | "playlists"
  | "subscriptions"
  | "history"
  | "notifications"
  | "search"
  | "generic";

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

const defaultContent: Record<
  EmptyStateType,
  { icon: React.ReactNode; title: string; description: string }
> = {
  videos: {
    icon: <IconVideo className="h-10 w-10" />,
    title: "No videos yet",
    description: "Upload your first video to get started sharing your content.",
  },
  playlists: {
    icon: <IconPlaylist className="h-10 w-10" />,
    title: "No playlists",
    description: "Create playlists to organize your favorite videos.",
  },
  subscriptions: {
    icon: <IconUsers className="h-10 w-10" />,
    title: "No subscriptions",
    description: "Subscribe to channels to see their videos here.",
  },
  history: {
    icon: <IconHistory className="h-10 w-10" />,
    title: "No watch history",
    description: "Videos you watch will appear here.",
  },
  notifications: {
    icon: <IconBell className="h-10 w-10" />,
    title: "No notifications",
    description: "You're all caught up! Check back later for updates.",
  },
  search: {
    icon: <IconSearch className="h-10 w-10" />,
    title: "No results found",
    description: "Try adjusting your search or filters.",
  },
  generic: {
    icon: <IconFileOff className="h-10 w-10" />,
    title: "Nothing here",
    description: "This area is empty.",
  },
};

export function EmptyState({
  type = "generic",
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  const defaults = defaultContent[type];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-4",
        className
      )}
    >
      {/* Icon with gradient background */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full blur-xl scale-150 opacity-60" />
        <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center text-muted-foreground border border-border/50 shadow-inner">
          {icon || defaults.icon}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold mb-2">{title || defaults.title}</h3>

      {/* Description */}
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        {description || defaults.description}
      </p>

      {/* Action button */}
      {action && (
        action.href ? (
          <Button asChild>
            <Link href={action.href}>
              <IconPlus className="mr-2 h-4 w-4" />
              {action.label}
            </Link>
          </Button>
        ) : (
          <Button onClick={action.onClick}>
            <IconPlus className="mr-2 h-4 w-4" />
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}

/**
 * Compact empty state for inline use
 */
export function EmptyStateCompact({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-8 px-4 border border-dashed rounded-lg bg-muted/20",
        className
      )}
    >
      {icon && (
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
          {icon}
        </div>
      )}
      <h4 className="font-medium text-sm mb-1">{title}</h4>
      {description && (
        <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
      )}
    </div>
  );
}
