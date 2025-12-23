"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyPlaylists, createPlaylist, deletePlaylist } from "@/app/actions/playlist";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    ListVideo,
    Plus,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function StudioPlaylistsPage() {
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Create Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC"|"PRIVATE"|"UNLISTED">("PUBLIC");

  const fetchPlaylists = async () => {
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
    fetchPlaylists();
  }, []);

  const handleCreate = async () => {
      if (!title.trim()) {
          toast.error("Title is required");
          return;
      }
      setIsCreating(true);
      try {
          const result = await createPlaylist({ title, description, visibility });
          if (result.success) {
              toast.success("Playlist created");
              setIsCreateOpen(false);
              setTitle("");
              setDescription("");
              fetchPlaylists();
          } else {
              toast.error(result.error?.message || "Failed to create playlist");
          }
      } catch (e) {
          toast.error("An error occurred");
      } finally {
          setIsCreating(false);
      }
  };

  const handleDelete = async (id: string) => {
      if (!confirm("Are you sure? This cannot be undone.")) return;
      try {
          const result = await deletePlaylist(id);
          if (result.success) {
              toast.success("Playlist deleted");
              setPlaylists(prev => prev.filter(p => p.id !== id));
          } else {
              toast.error("Failed to delete playlist");
          }
      } catch (e) {
          toast.error("Error deleting playlist");
      }
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Playlists</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="w-4 h-4 mr-2" /> New Playlist
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Playlist</DialogTitle>
                    <DialogDescription>Add a new collection of videos to your channel.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Title</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter playlist title" />
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell viewers about your playlist" />
                    </div>
                    <div className="space-y-2">
                        <Label>Visibility</Label>
                        <RadioGroup value={visibility} onValueChange={(v: any) => setVisibility(v)} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="PUBLIC" id="p-public" />
                                <Label htmlFor="p-public">Public</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="PRIVATE" id="p-private" />
                                <Label htmlFor="p-private">Private</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="UNLISTED" id="p-unlisted" />
                                <Label htmlFor="p-unlisted">Unlisted</Label>
                            </div>
                        </RadioGroup>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={isCreating}>
                        {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[400px]">Playlist</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Video Count</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {playlists.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">No playlists found.</TableCell>
                    </TableRow>
                ) : (
                    playlists.map((playlist) => (
                        <TableRow key={playlist.id}>
                            <TableCell>
                                <div className="flex gap-4 items-center">
                                    <div className="w-24 h-14 bg-zinc-800 rounded flex items-center justify-center flex-shrink-0 relative overflow-hidden group">
                                         {playlist.thumbnailUrl ? (
                                             <img src={playlist.thumbnailUrl} className="w-full h-full object-cover" />
                                         ) : (
                                             <ListVideo className="text-zinc-500" />
                                         )}
                                         <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                             <Link href={`/playlists/${playlist.id}`} target="_blank" className="text-white">
                                                 <ExternalLink className="w-5 h-5" />
                                             </Link>
                                         </div>
                                    </div>
                                    <div className="flex flex-col">
                                        <Link href={`/studio/playlists/${playlist.id}`} className="font-medium hover:underline">
                                            {playlist.title}
                                        </Link>
                                        <span className="text-xs text-muted-foreground line-clamp-1">{playlist.description}</span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <span className="capitalize">{playlist.visibility.toLowerCase()}</span>
                            </TableCell>
                            <TableCell>{new Date(playlist.updatedAt).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">{playlist.videoCount}</TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem asChild>
                                            <Link href={`/studio/playlists/${playlist.id}`}>
                                                <Pencil className="mr-2 h-4 w-4" /> Edit
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(playlist.id)}>
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
