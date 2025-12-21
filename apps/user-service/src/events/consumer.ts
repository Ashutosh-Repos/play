// RabbitMQ event consumer for user-service
import * as amqp from "amqplib";
import { prisma } from "@repo/database";
import {
  EXCHANGES,
  ROUTING_KEYS,
  VideoPublishedEvent,
  VideoDeletedEvent,
} from "@repo/events";

import { checkIdempotency, markEventProcessed } from "../lib/redis.js";

let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
let channel: amqp.Channel | null = null;

import { serverEnv } from "@repo/config";

// Read at runtime, not module load time
const getRabbitMQUrl = () => serverEnv.RABBITMQ_URL;

const QUEUE_NAME = "user-service.video-events";

export async function startConsumer(): Promise<void> {
  const url = getRabbitMQUrl();

  try {
    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    // Declare exchange and queue
    await channel.assertExchange(EXCHANGES.VIDEO, "topic", { durable: true });
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    // Bind to video events we care about
    await channel.bindQueue(QUEUE_NAME, EXCHANGES.VIDEO, ROUTING_KEYS.VIDEO_PUBLISHED);
    await channel.bindQueue(QUEUE_NAME, EXCHANGES.VIDEO, ROUTING_KEYS.VIDEO_DELETED);

    // Consume messages
    await channel.consume(QUEUE_NAME, handleMessage, { noAck: false });

    console.log("✅ User-service consumer started");
  } catch (error) {
    console.error("❌ Failed to start consumer:", error);
    throw error;
  }
}

async function handleMessage(msg: amqp.ConsumeMessage | null): Promise<void> {
  if (!msg || !channel) return;

  try {
    const event = JSON.parse(msg.content.toString());

    switch (event.type) {
      case "video.published":
        await handleVideoPublished(event as VideoPublishedEvent);
        break;
      case "video.deleted":
        await handleVideoDeleted(event as VideoDeletedEvent);
        break;
      default:
        console.log("Unknown event type:", event.type);
    }

    channel.ack(msg);
  } catch (error) {
    console.error("Error handling message:", error);
    // Reject and don't requeue
    channel.nack(msg, false, false);
  }
}

async function handleVideoPublished(event: VideoPublishedEvent): Promise<void> {
  const { videoId, channelId } = event.payload;

  // Idempotency Check: Use videoId + eventType as unique key (or messageId if available)
  // Since we don't have messageId easily here without changing the envelope, 
  // and "published" happens once per video, videoId is unique enough for this specific event type.
  // Ideally, use a unique event ID from the producer.
  const idempotencyKey = `video.published:${videoId}`;
  
  if (await checkIdempotency(idempotencyKey)) {
    console.log(`Duplicate video.published event for ${videoId}, skipping`);
    return;
  }

  // Check if channel exists before updating
  const channelExists = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true },
  });

  if (!channelExists) {
    console.warn(`Channel ${channelId} not found, skipping videoCount increment`);
    return;
  }

  await prisma.channel.update({
    where: { id: channelId },
    data: { videoCount: { increment: 1 } },
  });

  await markEventProcessed(idempotencyKey);
  console.log(`✅ Incremented videoCount for channel ${channelId}`);
}

async function handleVideoDeleted(event: VideoDeletedEvent): Promise<void> {
  const { videoId, channelId } = event.payload;

  const idempotencyKey = `video.deleted:${videoId}`;
  
  if (await checkIdempotency(idempotencyKey)) {
     console.log(`Duplicate video.deleted event for ${videoId}, skipping`);
     return;
  }

  // Check if channel exists before updating
  const channelExists = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true },
  });

  if (!channelExists) {
    console.warn(`Channel ${channelId} not found, skipping videoCount decrement`);
    return;
  }

  // Safe decrement - use Prisma API to decrement videoCount
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { videoCount: true },
  });
  
  if (channel && channel.videoCount > 0) {
    await prisma.channel.update({
      where: { id: channelId },
      data: { videoCount: { decrement: 1 } },
    });
  }

  await markEventProcessed(idempotencyKey);
  console.log(`✅ Decremented videoCount for channel ${channelId}`);
}

export async function stopConsumer(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
}

