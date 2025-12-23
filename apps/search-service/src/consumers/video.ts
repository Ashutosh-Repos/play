import { Channel } from "amqplib";
import { meili, INDEX_VIDEOS } from "../lib/meili.js";
import { prisma } from "@repo/database";

import { EXCHANGES } from "@repo/events";

// Queue name should be unique for this service so it gets its own copy of fanout messages if any,
// but for 'video.ready' (Exchange: video-events), we want a dedicated queue for search indexing.
const QUEUE_NAME = "search-service-video-queue";
// const EXCHANGE_NAME = "video-events"; // Now using EXCHANGES constant

export const startVideoConsumer = async (channel: Channel) => {
  await channel.assertExchange(EXCHANGES.VIDEO, "topic", { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  // Bind to relevant routing keys
  await channel.bindQueue(QUEUE_NAME, EXCHANGES.VIDEO, "video.published"); 
  await channel.bindQueue(QUEUE_NAME, EXCHANGES.VIDEO, "video.updated"); 
  await channel.bindQueue(QUEUE_NAME, EXCHANGES.VIDEO, "video.deleted"); 
  
  // Engagement events come from a different exchange
  await channel.assertExchange(EXCHANGES.ENGAGEMENT, "topic", { durable: true });
  await channel.bindQueue(QUEUE_NAME, EXCHANGES.ENGAGEMENT, "video.stats.updated");

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
              where: { id: videoId },
              include: { channel: true }  // Include channel for proper indexing
          });

          if (video && video.visibility === "PUBLIC" && video.processingStatus === "READY") {
               // Transform to flat structure for Meilisearch
               await index.addDocuments([{
                   id: video.id,
                   title: video.title,
                   description: video.description,
                   thumbnailUrl: video.thumbnailUrl,
                   viewCount: Number(video.viewCount),
                   duration: video.duration,
                   createdAt: video.createdAt.getTime(),
                   publishedAt: video.publishedAt?.getTime() || video.createdAt.getTime(),
                   visibility: video.visibility,
                   processingStatus: video.processingStatus,
                   channelId: video.channelId,
                   channelName: video.channel.displayName,
                   channelHandle: video.channel.handle,
                   channelAvatarUrl: video.channel.avatarUrl,
                   tags: video.tags,
                   categoryId: video.categoryId,
                   likeCount: video.likeCount,
                   dislikeCount: video.dislikeCount,
                   commentCount: video.commentCount
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
