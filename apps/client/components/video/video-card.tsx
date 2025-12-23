import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

export interface VideoCardProps {
  id: string;
  title: string;
  thumbnailUrl: string;
  channelName: string;
  channelAvatarUrl?: string | null;
  viewCount: number;
  publishedAt: string;
  duration?: number | null;
}

export function VideoCard({
  id,
  title,
  thumbnailUrl,
  channelName,
  channelAvatarUrl,
  viewCount,
  publishedAt,
  duration,
}: VideoCardProps) {
  return (
    <Link href={`/watch/${id}`} className="group flex flex-col gap-2">
      {/* Thumbnail */}
      <div className="aspect-video relative rounded-xl overflow-hidden bg-zinc-900">
        <img 
          src={thumbnailUrl || "/placeholder.jpg"} 
          alt={title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {duration && (
          <div className="absolute bottom-1 right-1 bg-black/80 px-1 text-xs rounded font-medium text-white">
            {formatDuration(duration)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex gap-3 items-start">
        <Avatar className="w-9 h-9 border border-transparent group-hover:border-primary/50 transition-colors">
          <AvatarImage src={channelAvatarUrl || undefined} />
          <AvatarFallback>{channelName?.[0] || "?"}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-0.5">
          <h3 className="font-semibold text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
            {title}
          </h3>
          <div className="text-xs text-muted-foreground flex flex-col">
            <span className="hover:text-foreground transition-colors">{channelName}</span>
            <span>
              {Intl.NumberFormat('en-US', { notation: "compact" }).format(viewCount)} views • {formatDistanceToNow(new Date(publishedAt))} ago
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
