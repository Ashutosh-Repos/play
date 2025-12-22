"use client";

import { cn } from "@/lib/utils";
import { IconPlayerPlay } from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface Video {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  duration: number | null;
  viewCount: number | bigint;
  createdAt: Date;
}

interface VideoGridProps {
  videos: Video[];
  featured?: boolean;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatViews(count: number | bigint): string {
  const num = Number(count);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M views`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K views`;
  return `${num} views`;
}

function VideoCard({ video, featured = false }: { video: Video; featured?: boolean }) {
  return (
    <Link
      href={`/watch/${video.id}`}
      className={cn(
        "group block",
        featured && "md:grid md:grid-cols-2 md:gap-4"
      )}
    >
      <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <IconPlayerPlay className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}

        {/* Duration badge */}
        {video.duration !== null && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-xs font-medium rounded">
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </div>

      <div className={cn("mt-3", featured && "md:mt-0")}>
        <h3 className={cn(
          "font-semibold line-clamp-2 group-hover:text-primary transition-colors",
          featured ? "text-lg" : "text-sm"
        )}>
          {video.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {formatViews(video.viewCount)} • {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
        </p>
        {featured && video.thumbnailUrl && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2 hidden md:block">
            Click to watch this video
          </p>
        )}
      </div>
    </Link>
  );
}

export function VideoGrid({ videos, featured = false }: VideoGridProps) {
  if (videos.length === 0) return null;

  // If featured, show first video large
  if (featured && videos.length === 1 && videos[0]) {
    return <VideoCard video={videos[0]} featured />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
