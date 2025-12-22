"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoGrid } from "./video-grid";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconCalendar, IconUsers, IconVideo, IconEye, IconLink } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";

interface Video {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  duration: number | null;
  viewCount: number | bigint;
  createdAt: Date;
}

interface Channel {
  id: string;
  handle: string;
  displayName: string;
  description: string | null;
  subscriberCount: number;
  videoCount: number;
  totalViews: bigint;
  createdAt: Date;
  links?: { title: string; url: string }[] | null;
  location?: string | null;
  contactEmail?: string | null;
}

interface ChannelTabsProps {
  channel: Channel;
  videos: Video[];
  isOwnChannel: boolean;
}

function formatCount(count: number | bigint): string {
  const num = Number(count);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function ChannelTabs({ channel, videos, isOwnChannel }: ChannelTabsProps) {
  const links = channel.links as { title: string; url: string }[] | null;

  return (
    <Tabs defaultValue="videos" className="w-full">
      <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 gap-1 overflow-x-auto">
        <TabsTrigger
          value="home"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2 font-medium"
        >
          Home
        </TabsTrigger>
        <TabsTrigger
          value="videos"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2 font-medium"
        >
          Videos
        </TabsTrigger>
        <TabsTrigger
          value="playlists"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2 font-medium"
        >
          Playlists
        </TabsTrigger>
        <TabsTrigger
          value="about"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2 font-medium"
        >
          About
        </TabsTrigger>
      </TabsList>

      {/* Home Tab */}
      <TabsContent value="home" className="mt-6 animate-in fade-in duration-300">
        {videos.length > 0 ? (
          <div className="space-y-6">
            {/* Featured / Latest Video */}
            <div>
              <h3 className="font-semibold mb-4">Latest upload</h3>
              <VideoGrid videos={videos.slice(0, 1)} featured />
            </div>

            {/* Recent Videos */}
            {videos.length > 1 && (
              <div>
                <h3 className="font-semibold mb-4">Recent videos</h3>
                <VideoGrid videos={videos.slice(1, 5)} />
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            type="videos"
            description={
              isOwnChannel
                ? "Upload your first video to get started."
                : "This channel hasn't uploaded any videos yet."
            }
            action={isOwnChannel ? { label: "Upload Video", href: "/studio/upload" } : undefined}
          />
        )}
      </TabsContent>

      {/* Videos Tab */}
      <TabsContent value="videos" className="mt-6 animate-in fade-in duration-300">
        {videos.length > 0 ? (
          <VideoGrid videos={videos} />
        ) : (
          <EmptyState
            type="videos"
            description={
              isOwnChannel
                ? "Upload your first video to get started."
                : "This channel hasn't uploaded any videos yet."
            }
            action={isOwnChannel ? { label: "Upload Video", href: "/studio/upload" } : undefined}
          />
        )}
      </TabsContent>

      {/* Playlists Tab */}
      <TabsContent value="playlists" className="mt-6 animate-in fade-in duration-300">
        <EmptyState
          type="playlists"
          description={
            isOwnChannel
              ? "Create playlists to organize your videos."
              : "This channel hasn't created any playlists yet."
          }
        />
      </TabsContent>

      {/* About Tab */}
      <TabsContent value="about" className="mt-6 animate-in fade-in duration-300">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Description */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">Description</h3>
                {channel.description ? (
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {channel.description}
                  </p>
                ) : (
                  <p className="text-muted-foreground/60 italic">No description provided.</p>
                )}
              </CardContent>
            </Card>

            {/* Links */}
            {links && links.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">Links</h3>
                  <div className="flex flex-wrap gap-2">
                    {links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm"
                      >
                        <IconLink className="h-4 w-4" />
                        {link.title}
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Stats */}
          <div>
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">Stats</h3>
                <dl className="space-y-4 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <IconCalendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Joined</dt>
                      <dd className="font-medium">
                        {new Date(channel.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <IconUsers className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Subscribers</dt>
                      <dd className="font-medium">{formatCount(channel.subscriberCount)}</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <IconVideo className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Videos</dt>
                      <dd className="font-medium">{channel.videoCount}</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <IconEye className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Total views</dt>
                      <dd className="font-medium">{formatCount(channel.totalViews)}</dd>
                    </div>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Location */}
            {channel.location && (
              <Card className="mt-4">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">📍 {channel.location}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
