import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { ProfileHeader } from "@/components/profile/profile-header";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase(), status: "ACTIVE", deletedAt: null },
    select: { displayName: true, bio: true },
  });

  if (!user) {
    return { title: "User Not Found" };
  }

  return {
    title: `${user.displayName} | Play`,
    description: user.bio || `Check out ${user.displayName}'s profile on Play.`,
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase(), status: "ACTIVE", deletedAt: null },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
      channel: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
          bannerUrl: true,
          isVerified: true,
          subscriberCount: true,
          videoCount: true,
          description: true,
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  // Check if current user is subscribed
  let isSubscribed = false;
  if (session?.user?.id && user.channel) {
    const subscription = await prisma.subscription.findUnique({
      where: {
        subscriberId_channelId: {
          subscriberId: session.user.id,
          channelId: user.channel.id,
        },
      },
    });
    isSubscribed = !!subscription;
  }

  const isOwnProfile = session?.user?.id === user.id;
  const isAuthenticated = !!session?.user;

  return (
    <div className="w-full p-4">
      <ProfileHeader 
        user={user} 
        isSubscribed={isSubscribed} 
        isOwnProfile={isOwnProfile}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}
