// RabbitMQ event consumer for user-service
import * as amqp from "amqplib";
import { prisma } from "@repo/database";
import {
  EXCHANGES,
  ROUTING_KEYS,
  VideoPublishedEvent,
  VideoDeletedEvent,
} from "@repo/events";

let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
let channel: amqp.Channel | null = null;

const QUEUE_NAME = "user-service.video-events";

export async function startConsumer(): Promise<void> {
  const url = process.env.RABBITMQ_URL || "amqp://localhost:5672";

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
  const { channelId } = event.payload;

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

  console.log(`✅ Incremented videoCount for channel ${channelId}`);
}

async function handleVideoDeleted(event: VideoDeletedEvent): Promise<void> {
  const { channelId } = event.payload;

  // Check if channel exists before updating
  const channelExists = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true },
  });

  if (!channelExists) {
    console.warn(`Channel ${channelId} not found, skipping videoCount decrement`);
    return;
  }

  // Safe decrement - won't go below 0
  await prisma.$executeRaw`UPDATE channels SET video_count = GREATEST(video_count - 1, 0) WHERE id = ${channelId}`;

  console.log(`✅ Decremented videoCount for channel ${channelId}`);
}

export async function stopConsumer(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
}

