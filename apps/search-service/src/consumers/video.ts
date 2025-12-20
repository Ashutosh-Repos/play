import { Channel } from "amqplib";
import { meili, INDEX_VIDEOS } from "../lib/meili.js";
import { prisma } from "@repo/database";

// Queue name should be unique for this service so it gets its own copy of fanout messages if any,
// but for 'video.ready' (Exchange: video-events), we want a dedicated queue for search indexing.
const QUEUE_NAME = "search-service-video-queue";
const EXCHANGE_NAME = "video-events"; // Defined in @repo/events

export const startVideoConsumer = async (channel: Channel) => {
  await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  // Bind to relevant routing keys
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, "video.published"); // New video published (was: video.ready)
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, "video.updated"); // Metadata change
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, "video.deleted"); // Soft/Hard delete
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, "video.stats.updated"); // Engagement updates

  console.log(`🎧 Listening for video events on ${QUEUE_NAME}...`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const routingKey = msg.fields.routingKey;
      const content = JSON.parse(msg.content.toString());
      
      // video.stats.updated wrapper
      const payload = content.payload || content; 
      const { videoId } = payload;

      console.log(`Event received: ${routingKey} for ${videoId}`);

      const index = meili.index(INDEX_VIDEOS);

      if (routingKey === "video.deleted") {
          await index.deleteDocument(videoId);
          console.log(`🗑️ Removed ${videoId} from search index`);
      } else if (routingKey === "video.stats.updated") {
          // Partial update
          // Stats payload: { videoId, viewCount, likeCount, commentCount }
          await index.updateDocuments([{
              id: videoId,
              ...payload
          }]);
          console.log(`📈 Stats updated for ${videoId}`);
      } else {
          // video.published or video.updated
          // fetch fresh data from DB to ensure consistency
          // Note: for video.published, payload might differ, but fetching DB is safest source of truth
          const video = await prisma.video.findUnique({
              where: { id: videoId }
          });

          if (video && video.visibility === "PUBLIC" && video.processingStatus === "READY") {
               await index.addDocuments([{
                   ...video,
                   viewCount: Number(video.viewCount),
                   createdAt: video.createdAt.getTime()
               }]);
               console.log(`🔍 Indexed/Updated ${videoId}`);
          } else {
              // If it became private or not ready, remove it
              await index.deleteDocument(videoId);
              console.log(`🔒 Removed ${videoId} (Not Public/Ready)`);
          }
      }

      channel.ack(msg);
    } catch (error) {
      console.error("Error processing event:", error);
      // Nack with requeue to retry on transient errors (e.g. Meilisearch unavailable)
      channel.nack(msg, false, true);
    }
  });
};
