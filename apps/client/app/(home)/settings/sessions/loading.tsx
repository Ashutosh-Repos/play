import { SessionListSkeleton, CardSkeleton } from "@/components/ui/skeleton-cards";

export default function SessionsSettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-32 bg-accent animate-pulse rounded mb-2" />
        <div className="h-4 w-64 bg-accent/50 animate-pulse rounded" />
      </div>
      <CardSkeleton />
      <SessionListSkeleton count={4} />
    </div>
  );
}
