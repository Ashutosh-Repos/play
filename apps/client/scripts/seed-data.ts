
import { PrismaClient, VideoVisibility, ProcessingStatus, UserStatus } from "@repo/database";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding data...");

  // 1. Create Test User
  const email = "testuser@example.com";
  const password = "password123";
  const hashedPassword = await bcrypt.hash(password, 10);
  const username = "testuser";

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        username,
        displayName: "Test User",
        passwordHash: hashedPassword,
        emailVerified: true,
        status: UserStatus.ACTIVE,
      },
    });
    console.log("Created user:", user.email);
  } else {
    console.log("User already exists:", user.email);
    // Update password just in case
    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword, status: UserStatus.ACTIVE }
    });
  }

  // 2. Create Channel
  let channel = await prisma.channel.findUnique({ where: { userId: user.id } });
  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        userId: user.id,
        handle: username,
        displayName: "Test Channel",
      },
    });
    console.log("Created channel:", channel.handle);
  } else {
      console.log("Channel already exists:", channel.handle);
  }

  // 3. Create Video
  // Check if any video exists for this channel
  const existingVideo = await prisma.video.findFirst({ where: { channelId: channel.id } });

  if (!existingVideo) {
    const videoId = uuid();
    const video = await prisma.video.create({
      data: {
        id: videoId,
        title: "Test Video for verification",
        description: "This is a seed video.",
        channelId: channel.id,
        hlsPlaylistUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", // Big Buck Bunny HLS
        thumbnailUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
        duration: 600,
        visibility: VideoVisibility.PUBLIC,
        processingStatus: ProcessingStatus.READY,
        viewCount: 100, // Make it visible in trending
      },
    });
    console.log("Created video:", video.id);
  } else {
      console.log("Video already exists:", existingVideo.id);
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
