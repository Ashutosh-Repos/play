import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ChannelLoading() {
  return (
    <div className="container max-w-6xl py-6 space-y-6 animate-in fade-in duration-500">
      {/* Banner */}
      <Skeleton className="w-full h-32 sm:h-40 md:h-48 lg:h-56 rounded-xl" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center px-4 py-4">
        <Skeleton className="h-20 w-20 sm:h-28 sm:w-28 rounded-full -mt-12 sm:-mt-16" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-14" />
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-video rounded-xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
