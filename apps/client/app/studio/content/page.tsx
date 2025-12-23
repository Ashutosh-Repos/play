"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  MoreVertical, 
  Pencil, 
  Trash2, 
  ExternalLink,
  Loader2,
  Eye,
  EyeOff,
  Clock
} from "lucide-react";
import { getMyVideos, deleteVideo } from "@/app/actions/video";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function StudioContentPage() {
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<any[]>([]);

  const fetchVideos = async () => {
    try {
      const result = await getMyVideos({ limit: 50 });
      if (result.success && result.data) {
        setVideos(result.data.items);
      }
    } catch (error) {
       console.error(error);
       toast.error("Failed to load videos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    
    const result = await deleteVideo(id);
    if (result.success) {
      toast.success("Video deleted");
      fetchVideos(); // Refresh
    } else {
      toast.error("Failed to delete video");
    }
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Channel Content</h1>
        <Button asChild>
          <Link href="/studio/upload">Create</Link>
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[400px]">Video</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Comments</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                        No videos found. Upload your first video!
                    </TableCell>
                </TableRow>
            ) : (
                videos.map((video) => (
                <TableRow key={video.id}>
                    <TableCell>
                    <div className="flex gap-4 items-start">
                        <div className="w-28 h-16 bg-zinc-800 rounded-md overflow-hidden relative flex-shrink-0">
                           {video.thumbnailUrl ? (
                               <img src={video.thumbnailUrl} className="w-full h-full object-cover" />
                           ) : (
                               <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No Thumb</div>
                           )}
                           <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1 rounded text-white">
                               {video.duration ? formatDuration(video.duration) : '--:--'}
                           </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Link href={`/studio/video/${video.id}`} className="font-medium hover:underline line-clamp-2">
                                {video.title || "Untitled Video"}
                            </Link>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                                {video.description || "No description"}
                            </p>
                        </div>
                    </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            {getStatusIcon(video.visibility)}
                            <span className="capitalize">{video.visibility.toLowerCase()}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex flex-col text-sm">
                            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                            <span className="text-xs text-muted-foreground">Uploaded</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-right">{video.viewCount}</TableCell>
                    <TableCell className="text-right">{video.commentCount}</TableCell>
                    <TableCell>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                                <Link href={`/studio/video/${video.id}`} className="flex items-center w-full cursor-pointer">
                                    <Pencil className="mr-2 h-4 w-4" /> Edit
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Link href={`/watch/${video.id}`} target="_blank" className="flex items-center w-full cursor-pointer">
                                    <ExternalLink className="mr-2 h-4 w-4" /> View on YouTube
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={() => handleDelete(video.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </TableCell>
                </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function getStatusIcon(status: string) {
    if (status === 'PUBLIC') return <Eye className="w-4 h-4 text-green-500" />;
    if (status === 'PRIVATE') return <EyeOff className="w-4 h-4 text-zinc-500" />;
    if (status === 'SCHEDULED') return <Clock className="w-4 h-4 text-blue-500" />;
    return <EyeOff className="w-4 h-4" />;
}

function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
