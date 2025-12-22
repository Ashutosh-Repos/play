"use client";

import { Skeleton } from "./skeleton";
import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";

/**
 * Profile page skeleton with banner, avatar, and content areas
 */
export function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Banner */}
      <Skeleton className="w-full h-36 md:h-52 lg:h-64 rounded-2xl" />

      {/* Profile info */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-end -mt-16 md:-mt-20 px-4 relative z-10">
        {/* Avatar */}
        <Skeleton className="h-28 w-28 md:h-36 md:w-36 rounded-full ring-4 ring-background shadow-xl" />

        {/* Info */}
        <div className="flex-1 space-y-3 pt-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-3 w-40" />
        </div>

        {/* Button */}
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4 px-4">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-16" />
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-2 px-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

/**
 * Generic card skeleton
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="pt-6 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}

/**
 * Video card skeleton for grid layouts
 */
export function VideoCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Thumbnail */}
      <Skeleton className="aspect-video rounded-xl" />
      {/* Info row */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

/**
 * Video grid skeleton
 */
export function VideoGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Settings form skeleton
 */
export function SettingsFormSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>

        {/* Button */}
        <Skeleton className="h-10 w-32" />
      </CardContent>
    </Card>
  );
}

/**
 * Channel card skeleton
 */
export function ChannelCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 p-4 rounded-lg border", className)}>
      <Skeleton className="h-12 w-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-9 w-24" />
    </div>
  );
}

/**
 * List item skeleton for sessions, connections, etc
 */
export function ListItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 py-3", className)}>
      <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

/**
 * Session list skeleton
 */
export function SessionListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}
