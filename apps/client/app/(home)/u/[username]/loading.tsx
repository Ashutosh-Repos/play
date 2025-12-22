import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-6 w-full">
      {/* Banner skeleton */}
      <Skeleton className="w-full h-32 md:h-48 lg:h-56 rounded-xl" />

      {/* Profile info skeleton */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-end -mt-12 md:-mt-16 px-4">
        <Skeleton className="h-24 w-24 md:h-32 md:w-32 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Tabs skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </div>
  );
}
