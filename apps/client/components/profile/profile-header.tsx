"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, EmptyStateCompact } from "@/components/ui/empty-state";
import { IconCheck, IconCalendar, IconUsers, IconVideo, IconSettings, IconVideoPlus, IconMapPin, IconExternalLink } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import { SubscribeButton } from "./subscribe-button";

interface Channel {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isVerified: boolean;
  subscriberCount: number;
  videoCount: number;
  description: string | null;
}

interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  channel: Channel | null;
}

interface ProfileHeaderProps {
  user: User;
  isSubscribed: boolean;
  isOwnProfile: boolean;
  isAuthenticated: boolean;
}

function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

export function ProfileHeader({ user, isSubscribed, isOwnProfile, isAuthenticated }: ProfileHeaderProps) {
  const channel = user.channel;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Banner with gradient overlay */}
      <div className="relative animate-in slide-in-from-top duration-700">
        {channel?.bannerUrl ? (
          <div className="w-full h-40 md:h-56 lg:h-72 rounded-2xl overflow-hidden relative">
            <Image
              src={channel.bannerUrl}
              alt="Channel banner"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          </div>
        ) : (
          <div className="w-full h-40 md:h-56 lg:h-72 rounded-2xl bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />
          </div>
        )}
      </div>

      {/* Profile Info - Floating Card Style */}
      <div className="flex flex-col md:flex-row gap-5 md:gap-8 items-start md:items-end -mt-20 md:-mt-24 px-4 relative z-10">
        {/* Avatar with animation */}
        <div className="animate-in zoom-in duration-500 delay-100">
          <Avatar className="h-32 w-32 md:h-40 md:w-40 ring-4 ring-background shadow-2xl">
            <AvatarImage src={channel?.avatarUrl || user.avatarUrl || undefined} />
            <AvatarFallback className="text-4xl md:text-6xl bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
              {user.displayName?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Info with staggered animation */}
        <div className="flex-1 space-y-3 pt-2 animate-in slide-in-from-bottom duration-500 delay-150">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
              {channel?.displayName || user.displayName}
            </h1>
            {channel?.isVerified && (
              <Badge className="gap-1 bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                <IconCheck className="h-3 w-3" />
                Verified
              </Badge>
            )}
          </div>

          <p className="text-muted-foreground font-medium text-lg">@{user.username}</p>

          {/* Stats Row with hover effects */}
          {channel && (
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2 hover:text-foreground transition-colors cursor-default group">
                <IconUsers className="h-4 w-4 group-hover:scale-110 transition-transform" />
                <span>
                  <strong className="text-foreground font-semibold">{formatCount(channel.subscriberCount)}</strong>
                  <span className="hidden sm:inline ml-1">subscribers</span>
                </span>
              </span>
              <span className="flex items-center gap-2 hover:text-foreground transition-colors cursor-default group">
                <IconVideo className="h-4 w-4 group-hover:scale-110 transition-transform" />
                <span>
                  <strong className="text-foreground font-semibold">{channel.videoCount}</strong>
                  <span className="hidden sm:inline ml-1">videos</span>
                </span>
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconCalendar className="h-4 w-4" />
            <span>Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</span>
          </div>
        </div>

        {/* Action buttons with animation */}
        <div className="flex gap-3 mt-2 md:mt-0 animate-in slide-in-from-right duration-500 delay-200">
          {isOwnProfile ? (
            <>
              <Button variant="outline" asChild className="group">
                <Link href="/settings/profile">
                  <IconSettings className="mr-2 h-4 w-4 group-hover:rotate-90 transition-transform duration-300" />
                  Edit Profile
                </Link>
              </Button>
              {channel && (
                <Button asChild>
                  <Link href="/studio/upload">
                    <IconVideoPlus className="mr-2 h-4 w-4" />
                    Upload
                  </Link>
                </Button>
              )}
            </>
          ) : channel ? (
            isAuthenticated ? (
              <SubscribeButton
                channelId={channel.id}
                isSubscribed={isSubscribed}
                subscriberCount={channel.subscriberCount}
              />
            ) : (
              <Button asChild>
                <Link href="/login">Sign in to Subscribe</Link>
              </Button>
            )
          ) : null}
        </div>
      </div>

      {/* Tabs with improved styling */}
      <Tabs defaultValue="about" className="w-full animate-in fade-in duration-500 delay-300">
        <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 gap-6 px-4">
          <TabsTrigger 
            value="home" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-4 font-medium transition-all duration-200"
          >
            Home
          </TabsTrigger>
          <TabsTrigger 
            value="videos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-4 font-medium transition-all duration-200"
          >
            Videos
          </TabsTrigger>
          <TabsTrigger 
            value="about"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-4 font-medium transition-all duration-200"
          >
            About
          </TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <EmptyState
            icon={<IconVideoPlus className="h-10 w-10" />}
            title="No featured content"
            description={isOwnProfile 
              ? "Feature your best content here to showcase to visitors."
              : "This channel hasn't featured any content yet."}
          />
        </TabsContent>

        <TabsContent value="videos" className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {channel ? (
            <EmptyState
              type="videos"
              description={isOwnProfile 
                ? "Upload your first video to get started sharing your content."
                : "This channel hasn't uploaded any videos yet."}
              action={isOwnProfile ? { label: "Upload Video", href: "/studio/upload" } : undefined}
            />
          ) : (
            <EmptyStateCompact
              icon={<IconVideo className="h-6 w-6" />}
              title="No channel"
              description="This user hasn't created a channel yet."
            />
          )}
        </TabsContent>

        <TabsContent value="about" className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Description Card */}
            <Card className="overflow-hidden">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Description
                </h3>
                {channel?.description || user.bio ? (
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {channel?.description || user.bio}
                  </p>
                ) : (
                  <p className="text-muted-foreground/60 italic">
                    No description provided.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="overflow-hidden">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Details
                </h3>
                <dl className="space-y-4 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                    <dt className="text-muted-foreground flex items-center gap-2">
                      <IconCalendar className="h-4 w-4" />
                      Joined
                    </dt>
                    <dd className="font-medium">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </dd>
                  </div>
                  {channel && (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                        <dt className="text-muted-foreground flex items-center gap-2">
                          <IconUsers className="h-4 w-4" />
                          Subscribers
                        </dt>
                        <dd className="font-medium">{formatCount(channel.subscriberCount)}</dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                        <dt className="text-muted-foreground flex items-center gap-2">
                          <IconVideo className="h-4 w-4" />
                          Videos
                        </dt>
                        <dd className="font-medium">{channel.videoCount}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

