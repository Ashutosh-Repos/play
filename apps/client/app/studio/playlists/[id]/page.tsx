"use client";

import { use, useEffect, useState } from "react";
import { getPlaylist, updatePlaylist, removeVideoFromPlaylist, reorderPlaylistVideos } from "@/app/actions/playlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Save, Trash2, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PlaylistEditorProps {
    params: Promise<{ id: string }>;
}

export default function PlaylistEditorPage({ params }: PlaylistEditorProps) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playlist, setPlaylist] = useState<any>(null);
  
  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("");

  const fetchPlaylist = async () => {
      try {
          const result = await getPlaylist(id);
          if (result.success && result.data) {
              setPlaylist(result.data);
              setTitle(result.data.title);
              setDescription(result.data.description || "");
              setVisibility(result.data.visibility);
          } else {
              toast.error("Playlist not found");
          }
      } catch (e) {
          console.error(e);
          toast.error("Failed to load playlist");
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchPlaylist();
  }, [id]);

  const handleSave = async () => {
      setSaving(true);
      try {
          const result = await updatePlaylist(id, { title, description, visibility });
          if (result.success) {
              toast.success("Changes saved");
          } else {
              toast.error("Failed to save changes");
          }
      } catch (e) {
          toast.error("Error saving changes");
      } finally {
          setSaving(false);
      }
  };

  const handleRemoveVideo = async (videoId: string) => {
      if (!confirm("Remove video from playlist?")) return;
      try {
          const result = await removeVideoFromPlaylist(id, videoId);
          if (result.success) {
              toast.success("Video removed");
              // Optimistic update
              setPlaylist((prev: any) => ({
                  ...prev,
                  videos: prev.videos.filter((v: any) => v.id !== videoId)
              }));
          }
      } catch (e) {
          toast.error("Failed to remove video");
      }
  };

  const moveVideo = async (index: number, direction: 'up' | 'down') => {
      if (!playlist.videos) return;
      const videos = [...playlist.videos];
      
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= videos.length) return;

      // Swap
      [videos[index], videos[targetIndex]] = [videos[targetIndex], videos[index]];
      
      // Update local state immediately
      setPlaylist((prev: any) => ({ ...prev, videos }));

      // Persist (debounce optimized in real app, immediate here for simplicity)
      try {
          const ids = videos.map((v: any) => v.id);
          await reorderPlaylistVideos(id, ids);
      } catch (e) {
          toast.error("Failed to reorder");
          fetchPlaylist(); // Revert
      }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!playlist) return <div>Not found</div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Edit Playlist</h1>
            <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
            </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Metadata Column */}
            <div className="md:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                             <Label>Title</Label>
                             <Input value={title} onChange={e => setTitle(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                             <Label>Description</Label>
                             <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} />
                        </div>
                        <div className="space-y-2">
                            <Label>Visibility</Label>
                            <RadioGroup value={visibility} onValueChange={setVisibility}>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="PUBLIC" id="ed-public" />
                                    <Label htmlFor="ed-public">Public</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="PRIVATE" id="ed-private" />
                                    <Label htmlFor="ed-private">Private</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="UNLISTED" id="ed-unlisted" />
                                    <Label htmlFor="ed-unlisted">Unlisted</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Videos Column */}
            <div className="md:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Videos ({playlist.videos?.length || 0})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Video</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {playlist.videos?.map((video: any, index: number) => (
                                    <TableRow key={video.id}>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveVideo(index, 'up')} disabled={index === 0}>
                                                    <ArrowUp className="w-3 h-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveVideo(index, 'down')} disabled={index === playlist.videos.length - 1}>
                                                    <ArrowDown className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-3">
                                                 <img src={video.thumbnailUrl || "/placeholder.jpg"} className="w-20 h-12 object-cover rounded bg-zinc-800" />
                                                 <div className="flex flex-col justify-center">
                                                     <span className="font-medium line-clamp-1">{video.title}</span>
                                                     <span className="text-xs text-muted-foreground">{video.channelName}</span>
                                                 </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveVideo(video.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

        </div>
    </div>
  );
}
