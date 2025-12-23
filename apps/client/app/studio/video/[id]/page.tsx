"use client";

import { use, useEffect, useState } from "react";
import { getVideo, updateVideo, publishVideo } from "@/app/actions/video";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { IconLoader2, IconDeviceFloppy, IconSend } from "@tabler/icons-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface VideoEditorPageProps {
  params: Promise<{ id: string }>;
}

export default function VideoEditorPage({ params }: VideoEditorPageProps) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [video, setVideo] = useState<any>(null);

  // Form state
  // TODO: Use react-hook-form for better handling
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE" | "UNLISTED" | "SCHEDULED">("PRIVATE");

  useEffect(() => {
    async function fetchVideo() {
      try {
        const result = await getVideo(id);
        if (result.success && result.data) {
           const v = result.data as any; // Type assertion until we have full types
           setVideo(v);
           setTitle(v.title || "");
           setDescription(v.description || "");
           setVisibility(v.visibility || "PRIVATE");
        } else {
           toast.error("Failed to load video details");
        }
      } catch (e) {
         console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchVideo();
  }, [id]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateVideo(id, {
        title,
        description,
        // Don't include visibility in regular updates
      });

      if (result.success) {
        toast.success("Video saved successfully");
      } else {
        toast.error(result.error?.message || "Failed to save video");
      }
    } catch (e: any) {
      toast.error("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (video.processingStatus !== "READY") {
      toast.error("Video is still processing. Please wait.");
      return;
    }

    if (!title.trim()) {
      toast.error("Please add a title before publishing");
      return;
    }

    try {
      setPublishing(true);
      
      // First save any changes
      const saveResult = await updateVideo(id, {
        title,
        description,
      });

      if (!saveResult.success) {
        toast.error("Failed to save changes");
        return;
      }

      // Then publish with selected visibility
      const publishResult = await publishVideo(id, {
        visibility: visibility as "PUBLIC" | "UNLISTED" | "SCHEDULED",
      });

      if (publishResult.success) {
        toast.success(`Video published as ${visibility}!`);
        // Refresh video data
        const refreshResult = await getVideo(id);
        if (refreshResult.success && refreshResult.data) {
          setVideo(refreshResult.data);
          setVisibility(refreshResult.data.visibility as any);
        }
      } else {
        toast.error(publishResult.error?.message || "Failed to publish video");
      }
    } catch (e: any) {
      toast.error("An unexpected error occurred");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
     return <div className="flex h-screen items-center justify-center"><IconLoader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (!video) {
      return <div>Video not found</div>;
  }

  const isPublished = video.publishedAt !== null;
  const isReady = video.processingStatus === "READY";

  return (
    <div className="container mx-auto py-8 max-w-5xl">
       <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Video Details</h1>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} variant="outline">
               {saving ? <IconLoader2 className="w-4 h-4 animate-spin mr-2" /> : <IconDeviceFloppy className="w-4 h-4 mr-2" />}
               Save Changes
            </Button>
            {!isPublished && (
              <Button onClick={handlePublish} disabled={publishing || !isReady}>
                {publishing ? <IconLoader2 className="w-4 h-4 animate-spin mr-2" /> : <IconSend className="w-4 h-4 mr-2" />}
                Publish
              </Button>
            )}
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Metadata */}
          <div className="lg:col-span-2 space-y-6">
             <Card>
                <CardHeader>
                   <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-2">
                      <Label>Title (required)</Label>
                      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Add a title that describes your video" />
                   </div>
                   <div className="space-y-2">
                       <Label>Description</Label>
                       <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={8} placeholder="Tell viewers about your video" />
                   </div>
                </CardContent>
             </Card>
          </div>

          {/* Right Column: Preview & Visibility */}
          <div className="space-y-6">
              <Card>
                 <CardContent className="p-0 overflow-hidden rounded-t-lg">
                    {/* Video Player Placeholder or Thumbnail */}
                    <div className="aspect-video bg-black flex items-center justify-center relative">
                        {video.thumbnailUrl ? (
                            <img src={video.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                        ) : (
                           <p className="text-white text-sm">Processing...</p>
                        )}
                        {/* Status Badge */}
                        <div className="absolute top-2 right-2">
                          {isPublished ? (
                            <Badge variant="default">Published</Badge>
                          ) : isReady ? (
                            <Badge variant="secondary">Ready</Badge>
                          ) : (
                            <Badge variant="outline">{video.processingStatus}</Badge>
                          )}
                        </div>
                    </div>
                    <div className="p-4 space-y-2">
                       <p className="text-xs text-muted-foreground break-all">Video Link</p>
                       <a href={`/watch/${id}`} target="_blank" className="text-primary text-sm hover:underline truncate block">
                           {typeof window !== 'undefined' ? window.location.origin : ''}/watch/{id}
                       </a>
                    </div>
                 </CardContent>
              </Card>

               <Card>
                  <CardHeader>
                    <CardTitle>Visibility</CardTitle>
                    <CardDescription>
                      {isPublished 
                        ? `Currently: ${video.visibility}` 
                        : "Choose who can see your video"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <RadioGroup 
                        value={visibility} 
                        onValueChange={(v) => setVisibility(v as any)}
                        disabled={isPublished}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="PRIVATE" id="r-private" />
                          <Label htmlFor="r-private" className="cursor-pointer">
                            <div>Private</div>
                            <p className="text-xs text-muted-foreground">Only you can see</p>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="UNLISTED" id="r-unlisted" />
                          <Label htmlFor="r-unlisted" className="cursor-pointer">
                            <div>Unlisted</div>
                            <p className="text-xs text-muted-foreground">Anyone with link</p>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="PUBLIC" id="r-public" />
                          <Label htmlFor="r-public" className="cursor-pointer">
                            <div>Public</div>
                            <p className="text-xs text-muted-foreground">Everyone can see</p>
                          </Label>
                        </div>
                      </RadioGroup>
                      {!isReady && (
                        <p className="text-sm text-yellow-600 mt-4">
                          ⏳ Video is still processing. Publishing will be enabled when ready.
                        </p>
                      )}
                      {isPublished && (
                        <p className="text-sm text-muted-foreground mt-4">
                          ℹ️ Video is already published. Visibility cannot be changed.
                        </p>
                      )}
                  </CardContent>
               </Card>
          </div>
       </div>
    </div>
  );
}
