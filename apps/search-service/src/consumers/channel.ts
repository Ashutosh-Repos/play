import { Channel } from "amqplib";
import { meili, INDEX_CHANNELS } from "../lib/meili.js";

const QUEUE_NAME = "search-service-channel-queue";
const EXCHANGE_NAME = "channel-events"; // Defined in @repo/events

export const startChannelConsumer = async (channel: Channel) => {
  await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  // Bind to relevant routing keys
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, "channel.created");
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, "channel.updated");
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, "channel.deleted");

  console.log(`🎧 Listening for channel events on ${QUEUE_NAME}...`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const routingKey = msg.fields.routingKey;
      const content = JSON.parse(msg.content.toString());
      const payload = content.payload || content;
      const { channelId, handle, displayName, description, avatarUrl, isVerified } = payload;
       // Note: payload structure depends on what user-service emits. 
       // user-service emits:
       // Created: channelId, userId, handle (We might need to fetch more data or rely on limited data)
       // Updated: channelId, changes (partial)
       // Deleted: channelId, userId

      // Ideally we fetch the full object from DB to ensure search index is rich and consistent.
      // Importing prisma here violates microservice boundary strictness if we access user-service DB directly?
      // No, this monorepo shares @repo/database, so search-service CAN read the DB directly for indexing purposes.
      // This is the pattern used in video.ts as well.

      const { prisma } = await import("@repo/database");

      console.log(`Event received: ${routingKey} for channel ${channelId}`);
      const index = meili.index(INDEX_CHANNELS);

      if (routingKey === "channel.deleted") {
          await index.deleteDocument(channelId);
          console.log(`🗑️ Removed channel ${channelId} from search index`);
      } else {
          // Created or Updated - Fetch fresh source of truth
          const channelData = await prisma.channel.findUnique({
              where: { id: channelId }
          });

          if (channelData && !channelData.deletedAt) {
               await index.addDocuments([{
                   id: channelData.id,
                   handle: channelData.handle,
                   displayName: channelData.displayName,
                   description: channelData.description,
                   avatarUrl: channelData.avatarUrl,
                   isVerified: channelData.isVerified,
                   subscriberCount: Number(channelData.subscriberCount),
                   videoCount: Number(channelData.videoCount),
                   createdAt: channelData.createdAt.getTime()
               }]);
               console.log(`🔍 Indexed/Updated Channel ${channelData.handle}`);
          } else {
              // Soft deleted or missing
              await index.deleteDocument(channelId);
              console.log(`🔒 Removed channel ${channelId} (Deleted/Missing)`);
          }
      }

      channel.ack(msg);
    } catch (error) {
      console.error("Error processing channel event:", error);
      channel.nack(msg, false, true);
    }
  });
};
