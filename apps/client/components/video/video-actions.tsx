"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThumbsUp, ThumbsDown, Share2, MoreVertical } from "lucide-react";
import { AddToPlaylist } from "@/components/playlist/add-to-playlist";
import { toggleReaction, getMyReaction, recordView } from "@/app/actions/engagement";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface VideoActionsProps {
  videoId: string;
  initialLikeCount: number;
  initialDislikeCount: number;
  isAuthenticated: boolean;
}

export function VideoActions({
  videoId,
  initialLikeCount,
  initialDislikeCount,
  isAuthenticated,
}: VideoActionsProps) {
  const router = useRouter();
  
  // Optimistic State
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);
  const [userReaction, setUserReaction] = useState<"LIKE" | "DISLIKE" | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch initial reaction if authenticated
  useEffect(() => {
    // Record view
    recordView(videoId);

    if (isAuthenticated) {
      getMyReaction(videoId).then((res) => {
        if (res.success && res.data) {
          setUserReaction(res.data.reaction);
        }
      });
    }
  }, [videoId, isAuthenticated]);

  const handleReaction = async (type: "LIKE" | "DISLIKE") => {
    if (!isAuthenticated) {
      toast.error("Please sign in to react");
      router.push("/api/auth/signin");
      return;
    }

    // Optimistic Update
    const previousReaction = userReaction;
    const previousLikes = likeCount;
    const previousDislikes = dislikeCount;

    // Calculate new state locally
    let newReaction = userReaction === type ? null : type;
    let newLikes = likeCount;
    let newDislikes = dislikeCount;

    if (type === "LIKE") {
      if (userReaction === "LIKE") newLikes--; // Toggle off
      else {
        newLikes++; // Toggle on
        if (userReaction === "DISLIKE") newDislikes--; // Switch from dislike
      }
    } else { // DISLIKE
      if (userReaction === "DISLIKE") newDislikes--; // Toggle off
      else {
        newDislikes++; // Toggle on
        if (userReaction === "LIKE") newLikes--; // Switch from like
      }
    }

    setUserReaction(newReaction);
    setLikeCount(newLikes);
    setDislikeCount(newDislikes);

    // API Call
    try {
      const result = await toggleReaction(videoId, type);
      if (!result.success) {
        throw new Error(result.error?.message);
      }
      // Sync strictly with server response if provided, usually it matches optimism
       if (result.data) {
          if (typeof result.data.likeCount === "number") setLikeCount(result.data.likeCount);
          if (typeof result.data.dislikeCount === "number") setDislikeCount(result.data.dislikeCount);
          if (result.data.reaction !== undefined) setUserReaction(result.data.reaction);
      }
    } catch (error) {
      // Revert on error
      setUserReaction(previousReaction);
      setLikeCount(previousLikes);
      setDislikeCount(previousDislikes);
      toast.error("Failed to update reaction");
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
      <div className="flex items-center rounded-full bg-secondary/50 border border-border/50 overflow-hidden">
        <Button 
            variant={"ghost"}
            className={`rounded-none px-4 gap-2 hover:bg-secondary ${userReaction === "LIKE" ? "text-primary bg-primary/10" : ""}`}
            onClick={() => handleReaction("LIKE")}
        >
          <ThumbsUp className={`w-5 h-5 ${userReaction === "LIKE" ? "fill-current" : ""}`} />
          <span className="text-sm font-medium">{Intl.NumberFormat('en-US', { notation: "compact" }).format(likeCount)}</span>
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button 
            variant="ghost" 
            className={`rounded-none px-4 hover:bg-secondary ${userReaction === "DISLIKE" ? "text-destructive bg-destructive/10" : ""}`}
            onClick={() => handleReaction("DISLIKE")}
        >
          <ThumbsDown className={`w-5 h-5 ${userReaction === "DISLIKE" ? "fill-current" : ""}`} />
        </Button>
      </div>

      <Button variant="secondary" className="rounded-full gap-2 bg-secondary/50 border border-border/50" onClick={copyLink}>
        <Share2 className="w-5 h-5" />
        <span className="hidden sm:inline">Share</span>
      </Button>

      <AddToPlaylist videoId={videoId} isAuthenticated={isAuthenticated} />

      <Button variant="ghost" size="icon" className="rounded-full">
        <MoreVertical className="w-5 h-5" />
      </Button>
    </div>
  );
}
