"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyVideos } from "@/app/actions/video";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Loader2, Upload, Video, BarChart3, ArrowUpRight } from "lucide-react";
import { useSession } from "next-auth/react";

export default function StudioDashboard() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [latestVideo, setLatestVideo] = useState<any>(null);
  const [stats, setStats] = useState({ views: 0, subs: 0 });

  useEffect(() => {
    async function init() {
        try {
            // Fetch videos to get the latest one
            const result = await getMyVideos({ limit: 1 });
            if (result.success && result.data && result.data.items.length > 0) {
                setLatestVideo(result.data.items[0]);
            }
            
            // Channel stats would normally come from a specific endpoint
            // For now, we'll just mock or leave basic
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
    init();
  }, []);

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">Channel Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Latest Video */}
        <div className="space-y-6">
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>Latest Video Performance</CardTitle>
                </CardHeader>
                <CardContent>
                    {latestVideo ? (
                        <div className="space-y-4">
                            <div className="aspect-video bg-zinc-900 rounded-md overflow-hidden relative">
                                <img src={latestVideo.thumbnailUrl} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/50 transition-opacity">
                                    <Link href={`/watch/${latestVideo.id}`} target="_blank" className="text-white hover:underline flex items-center">
                                       Predict <ArrowUpRight className="w-4 h-4 ml-1" />
                                    </Link>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-medium line-clamp-1">{latestVideo.title}</h3>
                                <p className="text-sm text-muted-foreground">Published: {new Date(latestVideo.createdAt).toLocaleDateString()}</p>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-3 text-center">
                                <div>
                                    <div className="text-xl font-bold">{latestVideo.viewCount}</div>
                                    <div className="text-xs text-muted-foreground">Views</div>
                                </div>
                                <div>
                                    <div className="text-xl font-bold">{latestVideo.likeCount}</div>
                                    <div className="text-xs text-muted-foreground">Likes</div>
                                </div>
                                <div>
                                    <div className="text-xl font-bold">{latestVideo.commentCount}</div>
                                    <div className="text-xs text-muted-foreground">Comments</div>
                                </div>
                            </div>
                             <Button variant="outline" className="w-full" asChild>
                                <Link href="/studio/content">Go to Video Analytics</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-center space-y-4">
                            <p className="text-muted-foreground">No videos uploaded yet.</p>
                            <Button asChild>
                                <Link href="/studio/upload">Upload Video</Link>
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Middle Col: Channel Analytics */}
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Channel Analytics</CardTitle>
                    <CardDescription>Current subscribers</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="text-4xl font-bold mb-2">
                        {/* Session user info doesn't typically have subs count unless extended. Using placeholder */}
                        0
                     </div>
                     <p className="text-xs text-muted-foreground mb-6">Subscribers</p>
                     
                     <div className="space-y-4">
                         <div className="flex justify-between items-center text-sm">
                             <span>Views (Last 28 days)</span>
                             <span className="font-medium">0</span>
                         </div>
                         <Separator />
                         <div className="flex justify-between items-center text-sm">
                             <span>Watch time (hours)</span>
                             <span className="font-medium">0.0</span>
                         </div>
                     </div>

                     <div className="mt-6">
                        <Button variant="link" className="p-0 h-auto text-primary">Go to Channel Analytics</Button>
                     </div>
                </CardContent>
             </Card>
        </div>

        {/* Right Col: News / Ideas */}
        <div className="space-y-6">
            <Card>
                 <CardHeader>
                     <CardTitle>News</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                     <div className="space-y-2">
                         <h4 className="font-medium text-sm">Introducing the New Studio</h4>
                         <p className="text-xs text-muted-foreground">
                             Welcome to your new Creator Studio! Detailed analytics, easier uploads, and better content management.
                         </p>
                         <Button variant="outline" size="sm" className="w-full">Read More</Button>
                     </div>
                 </CardContent>
            </Card>
        </div>

      </div>
    </div>
  );
}
