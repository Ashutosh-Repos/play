import { notFound } from "next/navigation";
import { getVideo } from "@/app/actions/video";
import { getCategoryVideos } from "@/app/actions/home";
import { VideoPlayer } from "@/components/video/video-player";
import { VideoCard } from "@/components/video/video-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Flag } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { VideoActions } from "@/components/video/video-actions";
import { CommentSection } from "@/components/video/comment-section";

interface PageProps {
  params: Promise<{ id: string }>;
}

import { auth } from "@/lib/auth";

export default async function WatchPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const result = await getVideo(id);

  if (!result.success || !result.data) {
    if (result.error?.code === "NOT_FOUND") {
      notFound();
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Error loading video</h1>
          <p className="text-muted-foreground">{result.error?.message || "Unknown error"}</p>
        </div>
      </div>
    );
  }

  const video = result.data;
  const isReady = video.processingStatus === "READY";

   // Fetch related videos (from same category if available)
   let relatedVideos: any[] = [];
   if (video.category?.slug) {
     const relatedResult = await getCategoryVideos(video.category.slug, { limit: 10 });
     if (relatedResult.success) {
       relatedVideos = relatedResult.data?.items.filter((v: any) => v.id !== video.id) || [];
     }
   }

  return (
    <div className="min-h-screen bg-transparent">
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Content - Player & Info */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            
            {/* Player Container */}
            <div className="w-full bg-black rounded-xl overflow-hidden shadow-2xl aspect-video ring-1 ring-white/10">
              {isReady && video.hlsPlaylistUrl ? (
                <VideoPlayer 
                  src={video.hlsPlaylistUrl} 
                  poster={video.thumbnailUrl || undefined}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-400">
                  {video.processingStatus === "FAILED" ? (
                    <>
                      <Flag className="w-12 h-12 mb-4 text-red-500" />
                      <p>Video processing failed</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 border-4 border-zinc-700 border-t-primary rounded-full animate-spin mb-4" />
                      <p>Video is processing...</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Video Title */}
            <h1 className="text-xl md:text-2xl font-semibold break-words mt-2">
              {video.title}
            </h1>

            {/* Channel & Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              
              {/* Channel Info */}
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border border-border">
                  <AvatarImage src={video.channel.avatarUrl || undefined} />
                  <AvatarFallback>{video.channel.displayName?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm hover:text-primary cursor-pointer transition-colors">
                    {video.channel.displayName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(video.channel.subscriberCount || 0)} subscribers
                  </span>
                </div>
                <Button className="ml-4 rounded-full font-medium" variant={video.channel.isVerified ? "default" : "secondary"}>
                  Subscribe
                </Button>
              </div>

              {/* Actions */}
              <VideoActions 
                  videoId={video.id} 
                  initialLikeCount={video.likeCount} 
                  initialDislikeCount={video.dislikeCount}
                  isAuthenticated={!!session?.user} 
              />
            </div>

            {/* Description Box */}
            <div className="bg-secondary/30 rounded-xl p-4 text-sm mt-2 hover:bg-secondary/50 transition-colors cursor-pointer group">
              <div className="flex gap-2 font-medium mb-2 text-primary/90">
                <span>{Number(video.viewCount).toLocaleString()} views</span>
                <span>•</span>
                <span>
                    {new Date(video.publishedAt || video.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    })}
                </span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">
                {video.description || "No description provided."}
              </p>
            </div>
            
            {/* Comments Section */}
            <CommentSection 
                videoId={video.id} 
                initialCount={video.commentCount} 
                currentUser={session?.user ? {
                    id: session.user.id,
                    displayName: session.user.displayName || session.user.username || "User",
                    avatarUrl: session.user.avatarUrl
                } : undefined}
            />

          </div>

          {/* Right Sidebar - Recommendations */}
          <div className="lg:col-span-4 flex flex-col gap-4">
             <h3 className="font-semibold text-lg px-1">Up Next</h3>
             
             {relatedVideos.length > 0 ? (
                relatedVideos.map((related) => (
                   <VideoCard 
                      key={related.id}
                      {...related}
                    />
                ))
             ) : (
                <p className="text-muted-foreground text-sm px-1">No related videos found.</p>
             )}
          </div>

        </div>
      </main>
    </div>
  );
}
