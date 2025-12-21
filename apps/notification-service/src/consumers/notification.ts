import { Channel } from "amqplib";
import { prisma } from "@repo/database";
import { pushNotification } from "../gateways/socket.js";

const QUEUE_NAME = "notification-service-queue";
// We listen to TWO exchanges: 'video-events' and 'engagement-events'
// Or simpler: bind to topics on the main exchanges if they are distinct.
// In this repo, we seem to use "video-events" and "engagement-events".
// We need to assert both exchanges? Or just assume they exist? Best to assert.

const VIDEO_EXCHANGE = "video-events";
const ENGAGEMENT_EXCHANGE = "engagement-events";

export const startNotificationConsumer = async (channel: Channel) => {
  await channel.assertExchange(VIDEO_EXCHANGE, "topic", { durable: true });
  await channel.assertExchange(ENGAGEMENT_EXCHANGE, "topic", { durable: true });
  
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  // Bindings
  await channel.bindQueue(QUEUE_NAME, VIDEO_EXCHANGE, "video.published");
  await channel.bindQueue(QUEUE_NAME, ENGAGEMENT_EXCHANGE, "comment.created");
  await channel.bindQueue(QUEUE_NAME, ENGAGEMENT_EXCHANGE, "video.liked");

  console.log(`🎧 Notification Consumer listening...`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString());
      const routingKey = msg.fields.routingKey;
      const payload = content.payload || content;

      console.log(`🔔 Received ${routingKey}`);

      if (routingKey === "video.published") {
          await handleVideoPublished(payload);
      } else if (routingKey === "comment.created") {
          await handleCommentCreated(payload);
      } else if (routingKey === "video.liked") {
            // await handleVideoLiked(payload); 
            // Skipping Like for now to reduce noise/complexity in MVP
      }

      channel.ack(msg);
    } catch (error) {
      console.error("Error processing notification:", error);
      // Requeue the message for retry if it's a transient error
      // Ideally check error type. For now, requeue everything except validation errors.
      channel.nack(msg, false, true);
    }
  });
};

import { VideoPublishedSchema, CommentCreatedSchema } from "@repo/events";

// ...

// Handlers
async function handleVideoPublished(rawPayload: any) {
    // Validate Payload
    const result = VideoPublishedSchema.safeParse(rawPayload);
    if (!result.success) {
        console.error("Invalid VideoPublished Payload:", result.error);
        return; // Don't process invalid events
    }
    
    const { videoId, channelId, title } = result.data;
    
    // 1. Get Channel Info 
    const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { displayName: true, avatarUrl: true }
    });
    
    if (!channel) return;

    // 2. Notify Subscribers in Chunks (Cursor-based Pagination)
    const BATCH_SIZE = 1000;
    let cursor: string | undefined = undefined;
    let hasMore = true;
    let totalNotified = 0;

    console.log(`📢 Starting notification broadcast for video ${videoId} from ${channel.displayName}`);

    const message = `${channel.displayName} uploaded: ${title}`;

    while (hasMore) {
        // Fetch batch
        const subs = await prisma.subscription.findMany({
            where: { channelId, notificationLevel: "ALL" },
            select: { id: true, subscriberId: true },
            take: BATCH_SIZE,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: 'asc' } // Stable sort for cursor
        });

        if (subs.length === 0) {
            hasMore = false;
            break;
        }

        // Update cursor for next iteration
        cursor = subs[subs.length - 1].id;
        
        // Process batch in parallel (Bounded concurrency within batch)
        await Promise.all(subs.map(async (sub: { id: string; subscriberId: string }) => {
            try {
                // Idempotency Check: Don't insert if duplicates exist for this video+user+type
                // Ideally, DB unique constraint (userId_videoId_type) should handle this.
                // We'll use findFirst for now as per original design.
                const exists = await prisma.notification.findFirst({
                    where: {
                        userId: sub.subscriberId,
                        videoId,
                        type: "NEW_VIDEO"
                    },
                    select: { id: true }
                });

                if (exists) return;

                const notif = await prisma.notification.create({
                    data: {
                        userId: sub.subscriberId,
                        type: "NEW_VIDEO",
                        title: "New Video",
                        message,
                        thumbnailUrl: channel.avatarUrl,
                        videoId,
                        channelId,
                        actorId: channelId
                    }
                });

                // WebSocket Push
                pushNotification(sub.subscriberId, "notification", notif);
                totalNotified++;
            } catch(e) { 
                console.error("Failed to notify sub", sub.subscriberId, e);
            }
        }));

        console.log(`📢 Processed batch of ${subs.length} subs. Total so far: ${totalNotified}`);

        if (subs.length < BATCH_SIZE) {
            hasMore = false;
        }
    }

    console.log(`✅ Finished notifying ${totalNotified} subscribers for video ${videoId}`);
}

async function handleCommentCreated(rawPayload: any) {
    const result = CommentCreatedSchema.safeParse(rawPayload);
    if (!result.success) {
        console.error("Invalid CommentCreated Payload:", result.error);
        return;
    }

    const { commentId, videoId, userId, content } = result.data;
    
    // 1. Get Video Owner
    const video = await prisma.video.findUnique({
        where: { id: videoId },
        select: { channelId: true, title: true }
    });
    
    if (!video) return;
    
    const channel = await prisma.channel.findUnique({
        where: { id: video.channelId },
        select: { userId: true }
    });
    
    if (!channel) return;
    
    // Don't notify if commenting on own video
    if (channel.userId === userId) return;

    // 2. Create Notification for Owner
    const actor = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, avatarUrl: true }
    });
    
    const message = `${actor?.displayName || "Someone"} commented: ${content.substring(0, 30)}...`;

    const notif = await prisma.notification.create({
        data: {
            userId: channel.userId, // Notify the channel owner (User)
            type: "COMMENT",
            title: "New Comment",
            message,
            thumbnailUrl: actor?.avatarUrl,
            videoId,
            commentId,
            actorId: userId
        }
    });

    // WebSocket Push
    pushNotification(channel.userId, "notification", notif);
}
