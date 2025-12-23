"use client";

import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ThumbsUp, ThumbsDown, MessageSquare, MoreVertical, Flag, Pin } from "lucide-react";
import { getComments, postComment, deleteComment } from "@/app/actions/engagement";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface CommentSectionProps {
  videoId: string;
  initialCount: number;
  currentUser?: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

export function CommentSection({ videoId, initialCount, currentUser }: CommentSectionProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"NEWEST" | "POPULAR">("NEWEST");
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchComments = async (reset = false) => {
    if (reset) {
      setLoading(true);
      cursorRef.current = null;
    }
    
    try {
      const result = await getComments(videoId, { 
        limit: 20, 
        sort,
        cursor: cursorRef.current || undefined 
      });

      if (result.success && result.data) {
        if (reset) {
          setComments(result.data.items);
        } else {
          setComments(prev => [...prev, ...result.data!.items]);
        }
        cursorRef.current = result.data.nextCursor;
        setHasMore(!!result.data.nextCursor);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments(true);
  }, [videoId, sort]);

  const handlePostComment = async () => {
    if (!newComment.trim() || !currentUser) {
        if (!currentUser) toast.error("Please sign in to comment");
        return;
    }

    setPosting(true);
    try {
      const result = await postComment(videoId, newComment);
      if (result.success && result.data) {
        toast.success("Comment posted");
        setNewComment("");
        // Prepend new comment optimistically or re-fetch
        // result.data should be the comment object
        const createdComment = result.data as any; // Cast needed as generic return might be loose
        setComments([createdComment, ...comments]);
      } else {
        toast.error("Failed to post comment");
      }
    } catch (error) {
      toast.error("Error posting comment");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
      try {
          const result = await deleteComment(commentId);
          if (result.success) {
              setComments(comments.filter(c => c.id !== commentId));
              toast.success("Comment deleted");
          }
      } catch (err) {
          toast.error("Failed to delete comment");
      }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-8 mb-6">
        <h3 className="font-bold text-xl">{initialCount} Comments</h3>
        <div className="flex gap-4 text-sm font-medium">
            <button 
                className={sort === "NEWEST" ? "text-primary" : "text-muted-foreground"}
                onClick={() => setSort("NEWEST")}
            >
                Newest
            </button>
            <button 
                className={sort === "POPULAR" ? "text-primary" : "text-muted-foreground"}
                onClick={() => setSort("POPULAR")}
            >
                Top
            </button>
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-4 mb-8">
        <Avatar className="w-10 h-10">
          <AvatarImage src={currentUser?.avatarUrl || undefined} />
          <AvatarFallback>{currentUser?.displayName?.[0] || "?"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 gap-2 flex flex-col">
            <Textarea 
                placeholder="Add a comment..." 
                className="resize-y min-h-[20px] bg-transparent border-b focus:border-b-2 rounded-none px-0 py-1 focus-visible:ring-0 border-0 border-b-muted-foreground/20 focus:border-primary transition-colors"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
            />
            {newComment && (
                <div className="flex justify-end gap-2 mt-2">
                    <Button variant="ghost" size="sm" onClick={() => setNewComment("")}>Cancel</Button>
                    <Button 
                        size="sm" 
                        disabled={!newComment.trim() || posting} 
                        onClick={handlePostComment}
                        className="rounded-full"
                    >
                        {posting && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                        Comment
                    </Button>
                </div>
            )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-6">
          {comments.map((comment) => (
              <div key={comment.id} className="flex gap-4 group">
                  <Avatar className="w-10 h-10">
                      <AvatarImage src={comment.author.avatarUrl} />
                      <AvatarFallback>{comment.author?.displayName?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">@{comment.author.username}</span>
                          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.createdAt))} ago</span>
                          {comment.isPinned && <Pin className="w-3 h-3 rotate-45 text-muted-foreground" />}
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed mb-2">{comment.content}</p>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-4">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                              <ThumbsUp className="w-4 h-4" />
                          </Button>
                          <span className="text-xs text-muted-foreground">{comment.likeCount > 0 ? comment.likeCount : ""}</span>
                          
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                              <ThumbsDown className="w-4 h-4" />
                          </Button> 

                          <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs font-medium">
                              Reply
                          </Button>
                      </div>
                  </div>
                  
                  {/* Menu */}
                  {(currentUser?.id === comment.author.id) && (
                       <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                                   <MoreVertical className="w-4 h-4" />
                               </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                               <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(comment.id)}>
                                   <Flag className="w-4 h-4 mr-2" /> Delete
                               </DropdownMenuItem>
                           </DropdownMenuContent>
                       </DropdownMenu>
                  )}
              </div>
          ))}
          
          {loading && (
              <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-muted-foreground" />
              </div>
          )}

          {!loading && hasMore && (
              <Button variant="ghost" className="w-full text-primary" onClick={() => fetchComments()}>
                  Load more
              </Button>
          )}
      </div>
    </div>
  );
}
