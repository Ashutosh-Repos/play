import { Channel } from "amqplib";
import { prisma } from "@repo/database";

const QUEUE_NAME = "feed-service-history-queue";
const EXCHANGE_NAME = "engagement-events"; // Defined in @repo/events

export const startHistoryConsumer = async (channel: Channel) => {
  await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  // Bind to view events
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, "video.viewed");

  console.log(`🎧 Listening for history events on ${QUEUE_NAME}...`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString());
      const payload = content.payload || content;
      const { videoId, userId, timestamp } = payload;

      if (videoId && userId) {
        console.log(`History: User ${userId} watched ${videoId}`);

        // Upsert WatchHistory
        await prisma.watchHistory.upsert({
            where: {
                userId_videoId: { userId, videoId }
            },
            create: {
                userId,
                videoId,
                lastWatchedAt: new Date(timestamp || Date.now()),
                watchCount: 1
            },
            update: {
                lastWatchedAt: new Date(timestamp || Date.now()),
                watchCount: { increment: 1 }
            }
        });
      }

      channel.ack(msg);
    } catch (error) {
      console.error("Error processing history event:", error);
      channel.nack(msg, false, false);
    }
  });
};
