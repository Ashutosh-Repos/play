import { VideoCard } from "@/components/video/video-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// Since we are in app router, we should use Server Actions or direct service calls wrapped in "use server" actions
// But `service-client.ts` is client-side implementation of fetch? No, it uses fetch which works on server too.
// However, `service-client.ts` uses relative URLs sometimes in client? No, it handles it.
// Let's create `app/actions/home.ts` to handle data fetching safely.

import { getFeed, getCategories } from "@/app/actions/home";

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [feedResult, categoriesResult] = await Promise.all([
    getFeed(),
    getCategories()
  ]);

  const videos = feedResult.success ? feedResult.data?.videos : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Categories Bar */}
      {categories && categories.length > 0 && (
        <ScrollArea className="w-full whitespace-nowrap">
           <div className="flex w-max space-x-2 pb-2">
             <Badge variant="default" className="cursor-pointer hover:bg-primary/90">All</Badge>
             {categories.map((cat) => (
               <Badge key={cat.id} variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                 {cat.name}
               </Badge>
             ))}
           </div>
           <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      {/* Video Grid */}
      <h2 className="text-xl font-bold">Recommended</h2>
      
      {videos && videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
          {videos.map((video: any) => (
            <VideoCard
              key={video.id}
              id={video.id}
              title={video.title}
              thumbnailUrl={video.thumbnailUrl}
              channelName={video.channelName || video.channelHandle || "Unknown"}
              channelAvatarUrl={video.channelAvatarUrl}
              viewCount={video.viewCount}
              publishedAt={video.publishedAt || video.createdAt}
              duration={video.duration}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground">
           <p>No videos found</p>
        </div>
      )}
    </div>
  );
}
