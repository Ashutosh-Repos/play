import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";

export default function ChannelNotFound() {
  return (
    <div className="container max-w-6xl py-12">
      <EmptyState
        title="Channel not found"
        description="The channel you're looking for doesn't exist or has been removed."
        icon={
          <span className="text-4xl">🔍</span>
        }
      />
      <div className="flex justify-center mt-6">
        <Button asChild variant="outline">
          <Link href="/">
            <IconArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Link>
        </Button>
      </div>
    </div>
  );
}
