import { auth } from "@/lib/auth";
import { channelService, subscriptionService } from "@/lib/service-client";
import { ChannelHeaderClient } from "@/components/channel/channel-header-client";
import { ChannelTabs } from "@/components/channel/channel-tabs";
import { Metadata } from "next";
import { notFound } from "next/navigation";

interface ChannelPageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: ChannelPageProps): Promise<Metadata> {
  const { handle } = await params;

  // Use service for metadata
  const result = await channelService.get(handle);

  if (!result.success || !result.data) {
    return { title: "Channel Not Found" };
  }

  const channel = result.data as { displayName: string; description: string | null };

  return {
    title: `${channel.displayName} | Play`,
    description: channel.description || `Watch videos from ${channel.displayName}`,
  };
}

export default async function ChannelPage({ params }: ChannelPageProps) {
  const { handle } = await params;
  const session = await auth();

  // Fetch channel and videos in parallel using services
  const [channelResult, videosResult] = await Promise.all([
    channelService.get(handle),
    channelService.getVideos(handle, { limit: 50 }),
  ]);

  if (!channelResult.success || !channelResult.data) {
    notFound();
  }

  const channel = channelResult.data as {
    id: string;
    handle: string;
    displayName: string;
    description: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    isVerified: boolean;
    subscriberCount: number;
    videoCount: number;
    totalViews: bigint;
    createdAt: string;
    links: { title: string; url: string }[] | null;
    location: string | null;
    contactEmail: string | null;
    user?: { id: string; username: string; status: string };
  };

  const videos = videosResult.success && videosResult.data
    ? videosResult.data.items.map(v => ({
        ...v,
        createdAt: new Date(v.createdAt),
      }))
    : [];

  // Check if current user is subscribed  
  let isSubscribed = false;
  if (session?.user?.id) {
    const subResult = await subscriptionService.status(channel.id);
    if (subResult.success && subResult.data) {
      isSubscribed = subResult.data.subscribed;
    }
  }

  const isOwnChannel = session?.user?.id === channel.user?.id;

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <ChannelHeaderClient
        channel={{
          id: channel.id,
          handle: channel.handle,
          displayName: channel.displayName,
          description: channel.description,
          avatarUrl: channel.avatarUrl,
          bannerUrl: channel.bannerUrl,
          isVerified: channel.isVerified,
          subscriberCount: channel.subscriberCount,
          videoCount: channel.videoCount,
        }}
        isSubscribed={isSubscribed}
        isOwnChannel={isOwnChannel}
        isAuthenticated={!!session?.user}
      />

      <ChannelTabs
        channel={{
          id: channel.id,
          handle: channel.handle,
          displayName: channel.displayName,
          description: channel.description,
          subscriberCount: channel.subscriberCount,
          videoCount: channel.videoCount,
          totalViews: channel.totalViews,
          createdAt: new Date(channel.createdAt),
          links: channel.links,
          location: channel.location,
          contactEmail: channel.contactEmail,
        }}
        videos={videos}
        isOwnChannel={isOwnChannel}
      />
    </div>
  );
}
