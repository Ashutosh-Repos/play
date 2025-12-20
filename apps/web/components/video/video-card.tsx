import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    duration: number | null;
    viewCount: bigint;
    publishedAt: Date | null;
    channel: {
      handle: string;
      displayName: string;
      user: {
        avatarUrl: string | null;
      };
    };
  };
  showChannel?: boolean;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}:${remainingMins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatViews(count: bigint): string {
  const num = Number(count);
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M views`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K views`;
  }
  return `${num} views`;
}

export function VideoCard({ video, showChannel = true }: VideoCardProps) {
  const duration = formatDuration(video.duration);
  const views = formatViews(video.viewCount);
  const timeAgo = video.publishedAt
    ? formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })
    : "";

  return (
    <Link href={`/watch/${video.id}`} className="group block">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted rounded-xl overflow-hidden mb-3">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <span className="text-2xl">🎬</span>
          </div>
        )}
        {duration && (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {duration}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex gap-3">
        {showChannel && (
          <Link href={`/channel/${video.channel.handle}`} className="flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {video.channel.user.avatarUrl ? (
                <Image
                  src={video.channel.user.avatarUrl}
                  alt={video.channel.displayName}
                  width={36}
                  height={36}
                  className="object-cover"
                />
              ) : (
                <span className="text-sm font-medium">
                  {video.channel.displayName[0]?.toUpperCase()}
                </span>
              )}
            </div>
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
            {video.title}
          </h3>
          {showChannel && (
            <Link
              href={`/channel/${video.channel.handle}`}
              className="text-xs text-muted-foreground hover:text-foreground mt-1 block"
            >
              {video.channel.displayName}
            </Link>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {views} • {timeAgo}
          </p>
        </div>
      </div>
    </Link>
  );
}
