import { Channel } from "amqplib";
import { prisma } from "@repo/database";

const QUEUE_NAME = "feed-service-video-queue";
const EXCHANGE_NAME = "video.events"; // Defined in @repo/events

export const startVideoConsumer = async (channel: Channel) => {
  await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  // Bind to video lifecycle events
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, "video.published");
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, "video.deleted");
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, "video.updated");

  console.log(`🎧 Listening for video events on ${QUEUE_NAME}...`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const routingKey = msg.fields.routingKey;
      const content = JSON.parse(msg.content.toString());
      const payload = content.payload || content;
      const { videoId } = payload;

      console.log(`Feed: Event received: ${routingKey} for ${videoId}`);

      if (routingKey === "video.published") {
        // Video published - could be used for feed generation
        // For now, just log it. In production, you might:
        // - Add to trending calculation
        // - Notify subscribers
        // - Update recommendation cache
        console.log(`📹 New video published: ${videoId}`);

        // Example: Update video stats for feed ranking
        const video = await prisma.video.findUnique({
          where: { id: videoId },
          select: {
            id: true,
            channelId: true,
            title: true,
            visibility: true,
            publishedAt: true
          }
        });

        if (video && video.visibility === "PUBLIC") {
          // Could trigger feed cache invalidation or update
          console.log(`✅ Video ${videoId} ready for feeds`);
        }

      } else if (routingKey === "video.deleted") {
        // Video deleted - remove from caches, feeds, etc.
        console.log(`🗑️ Video deleted: ${videoId}`);

        // Clean up watch history for deleted videos
        await prisma.watchHistory.deleteMany({
          where: { videoId }
        });

        console.log(`✅ Cleaned up watch history for ${videoId}`);

      } else if (routingKey === "video.updated") {
        // Video metadata updated - might affect feed ranking
        console.log(`📝 Video updated: ${videoId}`);

        // Check if visibility changed to non-public
        const video = await prisma.video.findUnique({
          where: { id: videoId },
          select: { visibility: true }
        });

        if (video && video.visibility !== "PUBLIC") {
          // Remove from watch history if video became private
          console.log(`🔒 Video ${videoId} is no longer public`);
        }
      }

      channel.ack(msg);
    } catch (error) {
      console.error("Error processing video event:", error);
      channel.nack(msg, false, false);
    }
  });
};
