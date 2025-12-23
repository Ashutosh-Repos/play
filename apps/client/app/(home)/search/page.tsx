import React from "react";
import { searchService } from "@/lib/service-client";
import { VideoCard } from "@/components/video/video-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface SearchPageProps {
  searchParams: Promise<{ q: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams; // Next.js 15: searchParams is a promise
  
  if (!q) {
     return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center p-4">
             <h2 className="text-2xl font-bold mb-2">Search Play</h2>
             <p className="text-muted-foreground">Enter a term to find videos.</p>
        </div>
     );
  }

  const result = await searchService.search(q, { limit: 20 });
  const hits = result.data?.hits || [];

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="mb-6">
           <h1 className="text-xl font-semibold">Search results for "{q}"</h1>
           <p className="text-sm text-muted-foreground mt-1">
              Found {result.data?.estimatedTotalHits || 0} videos
           </p>
        </div>
        
        <Separator className="my-4" />

        {hits.length === 0 ? (
           <div className="text-center py-20">
              <p className="text-lg font-medium">No results found.</p>
              <p className="text-muted-foreground">Try different keywords.</p>
           </div>
        ) : (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 gap-y-8">
              {hits.map((hit) => (
                <VideoCard
                  key={hit.id}
                  id={hit.id}
                  title={hit.title}
                  thumbnailUrl={hit.thumbnailUrl || ""}
                  channelName={hit.channelName}
                  channelAvatarUrl={hit.channelAvatarUrl}
                  viewCount={hit.viewCount}
                  publishedAt={new Date(hit.createdAt).toISOString()} // Meili stores timestamp
                  duration={hit.duration}
                />
              ))}
           </div>
        )}
      </div>
    </ScrollArea>
  );
}
