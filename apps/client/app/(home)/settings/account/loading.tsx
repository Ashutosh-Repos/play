import { SettingsFormSkeleton, ListItemSkeleton } from "@/components/ui/skeleton-cards";

export default function AccountSettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-32 bg-accent animate-pulse rounded mb-2" />
        <div className="h-4 w-64 bg-accent/50 animate-pulse rounded" />
      </div>
      <SettingsFormSkeleton />
      <div className="space-y-2">
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
      </div>
    </div>
  );
}
