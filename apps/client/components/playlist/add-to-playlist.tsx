"use client";

import { useState, useEffect } from "react";
import { Plus, Check, Lock, Globe, EyeOff, ListMusic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { getMyPlaylists, createPlaylist, addVideoToPlaylist, removeVideoFromPlaylist } from "@/app/actions/playlist";

import { useRouter } from "next/navigation";

interface AddToPlaylistProps {
  videoId: string;
  trigger?: React.ReactNode;
  isAuthenticated?: boolean;
}

export function AddToPlaylist({ videoId, trigger, isAuthenticated }: AddToPlaylistProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  
  const handleOpenChange = (newOpen: boolean) => {
      if (newOpen && !isAuthenticated) {
          toast.error("Please sign in to save videos");
          router.push("/api/auth/signin"); // Or standard login route
          return;
      }
      setOpen(newOpen);
  };
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  
  // New Playlist Form
  const [newTitle, setNewTitle] = useState("");
  const [newVisibility, setNewVisibility] = useState<"PUBLIC" | "PRIVATE" | "UNLISTED">("PRIVATE");

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const result = await getMyPlaylists({ limit: 50 });
      if (result.success && result.data) {
        setPlaylists(result.data.items);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load playlists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchPlaylists();
      setCreating(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;

    try {
      const result = await createPlaylist({
        title: newTitle,
        visibility: newVisibility,
      });

      if (result.success && result.data) {
        toast.success("Playlist created");
        setPlaylists([result.data, ...playlists]);
        setCreating(false);
        setNewTitle("");
        
        // Auto-add video to new playlist
        await handleToggle(result.data.id, false); // false = was not in playlist
      } else {
        toast.error("Failed to create playlist");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error creating playlist");
    }
  };

  const handleToggle = async (playlistId: string, isPresent: boolean) => {
    // Optimistic update?
    // Since we don't know initial state perfectly without backend check, 
    // we'll just try to ADD. 
    // If backend returns "ALREADY_EXISTS", we treat it as present.
    // For now, simpler interaction: Just click to ADD.
    // If we want remove, we need to know state.
    
    // Strategy: Try to ADD.
    try {
        const result = await addVideoToPlaylist(playlistId, videoId);
        if (result.success) {
            toast.success("Added to playlist");
        } else {
             if (result.error?.code === "ALREADY_EXISTS") {
                 toast.info("Video already in playlist");
             } else {
                 toast.error(result.error?.message || "Failed to add to playlist");
             }
        }
    } catch (e) {
        toast.error("Error updating playlist");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="secondary" className="gap-2 rounded-full">
            <ListMusic className="w-4 h-4" /> Save
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Save to playlist</DialogTitle>
        </DialogHeader>

        <div className="py-4">
           {loading ? (
               <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
           ) : (
               <ScrollArea className="h-[300px] pr-4">
                   <div className="space-y-4">
                       {playlists.map((playlist) => (
                           <div key={playlist.id} className="flex items-center justify-between group cursor-pointer hover:bg-secondary/50 p-2 rounded-md transition-colors" onClick={() => handleToggle(playlist.id, false)}>
                               <div className="flex flex-col">
                                   <span className="font-medium text-sm">{playlist.title}</span>
                                   <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                       {playlist.visibility === 'PUBLIC' && <Globe className="w-3 h-3" />}
                                       {playlist.visibility === 'PRIVATE' && <Lock className="w-3 h-3" />}
                                       {playlist.visibility === 'UNLISTED' && <EyeOff className="w-3 h-3" />}
                                       <span>{playlist.videoCount} videos</span>
                                   </div>
                               </div>
                               {/* Temporary: No checkbox state, just an Add button or indicator if we knew */}
                           </div>
                       ))}
                   </div>
               </ScrollArea>
           )}

           {!creating ? (
               <Button variant="ghost" className="w-full mt-4 justify-start gap-2" onClick={() => setCreating(true)}>
                   <Plus className="w-4 h-4" /> Create new playlist
               </Button>
           ) : (
               <div className="mt-4 p-4 border rounded-md space-y-4 bg-secondary/20">
                   <div className="space-y-2">
                       <Label>Name</Label>
                       <Input 
                            value={newTitle} 
                            onChange={(e) => setNewTitle(e.target.value)} 
                            placeholder="Enter playlist title..."
                            maxLength={150}
                        />
                   </div>
                   <div className="space-y-2">
                       <Label>Visibility</Label>
                       <Select value={newVisibility} onValueChange={(v: any) => setNewVisibility(v)}>
                           <SelectTrigger>
                               <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                               <SelectItem value="PUBLIC">Public</SelectItem>
                               <SelectItem value="UNLISTED">Unlisted</SelectItem>
                               <SelectItem value="PRIVATE">Private</SelectItem>
                           </SelectContent>
                       </Select>
                   </div>
                   <div className="flex justify-end gap-2">
                       <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
                       <Button onClick={handleCreate} disabled={!newTitle.trim()}>Create</Button>
                   </div>
               </div>
           )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
