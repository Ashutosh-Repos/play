import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconCheck, IconCalendar, IconUsers, IconVideo, IconSettings, IconVideoPlus } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
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
    <div className="space-y-6">
      {/* Banner with gradient overlay */}
      <div className="relative">
        {channel?.bannerUrl ? (
          <div className="w-full h-36 md:h-52 lg:h-64 rounded-2xl overflow-hidden">
            <img
              src={channel.bannerUrl}
              alt="Channel banner"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>
        ) : (
          <div className="w-full h-36 md:h-52 lg:h-64 rounded-2xl bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/30" />
        )}
      </div>

      {/* Profile Info - Floating Card Style */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-end -mt-16 md:-mt-20 px-4 relative z-10">
        <Avatar className="h-28 w-28 md:h-36 md:w-36 ring-4 ring-background shadow-xl">
          <AvatarImage src={channel?.avatarUrl || user.avatarUrl || undefined} />
          <AvatarFallback className="text-3xl md:text-5xl bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
            {user.displayName?.charAt(0)?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {channel?.displayName || user.displayName}
            </h1>
            {channel?.isVerified && (
              <Badge className="gap-1 bg-blue-500/10 text-blue-500 border-blue-500/20">
                <IconCheck className="h-3 w-3" />
                Verified
              </Badge>
            )}
          </div>

          <p className="text-muted-foreground font-medium">@{user.username}</p>

          {/* Stats Row */}
          {channel && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-default">
                <IconUsers className="h-4 w-4" />
                <strong className="text-foreground">{formatCount(channel.subscriberCount)}</strong> subscribers
              </span>
              <span className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-default">
                <IconVideo className="h-4 w-4" />
                <strong className="text-foreground">{channel.videoCount}</strong> videos
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <IconCalendar className="h-3.5 w-3.5" />
            Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-2 md:mt-0">
          {isOwnProfile ? (
            <>
              <Button variant="outline" asChild>
                <Link href="/settings/profile">
                  <IconSettings className="mr-2 h-4 w-4" />
                  Edit Profile
                </Link>
              </Button>
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
      <Tabs defaultValue="about" className="w-full">
        <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 gap-4">
          <TabsTrigger 
            value="home" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-3"
          >
            Home
          </TabsTrigger>
          <TabsTrigger 
            value="videos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-3"
          >
            Videos
          </TabsTrigger>
          <TabsTrigger 
            value="about"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-3"
          >
            About
          </TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="mt-8">
          <Card className="border-dashed">
            <CardContent className="pt-8 pb-8 flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <IconVideoPlus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No featured content</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {isOwnProfile 
                  ? "Feature your best content here to showcase to visitors."
                  : "This channel hasn't featured any content yet."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="videos" className="mt-8">
          <Card className="border-dashed">
            <CardContent className="pt-8 pb-8 flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <IconVideo className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">
                {channel ? "No videos yet" : "No channel"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {channel
                  ? isOwnProfile 
                    ? "Upload your first video to get started."
                    : "This channel hasn't uploaded any videos yet."
                  : "This user hasn't created a channel."}
              </p>
              {isOwnProfile && channel && (
                <Button className="mt-4" asChild>
                  <Link href="/studio/upload">
                    <IconVideoPlus className="mr-2 h-4 w-4" />
                    Upload Video
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="mt-8">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">Description</h3>
                {channel?.description || user.bio ? (
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {channel?.description || user.bio}
                  </p>
                ) : (
                  <p className="text-muted-foreground italic">
                    No description provided.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">Stats</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Joined</dt>
                    <dd className="font-medium">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </dd>
                  </div>
                  {channel && (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Subscribers</dt>
                        <dd className="font-medium">{formatCount(channel.subscriberCount)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Videos</dt>
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
