import amqp from "amqplib";
import { EXCHANGES, ROUTING_KEYS } from "@repo/events";
import { serverEnv } from "@repo/config";

let channel: amqp.Channel | null = null;

export async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(serverEnv.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGES.ENGAGEMENT, "topic", { durable: true });
    console.log("✅ Engagement Service connected to RabbitMQ");
  } catch (error) {
    console.error("❌ RabbitMQ Connection Error:", error);
  }
}

function publish(routingKey: string, message: object) {
  if (!channel) {
    console.warn("RabbitMQ channel not ready, skipping publish", routingKey);
    return;
  }
  channel.publish(
    EXCHANGES.ENGAGEMENT,
    routingKey,
    Buffer.from(JSON.stringify(message)),
    { persistent: true }
  );
}

export function emitVideoLiked(videoId: string, userId: string, type: "LIKE" | "DISLIKE") {
  publish("video.liked", {
    type: "video.liked",
    payload: { videoId, userId, reactionType: type, timestamp: new Date().toISOString() }
  });
}

export function emitVideoStats(videoId: string, stats: { viewCount?: number; likeCount?: number; commentCount?: number }) {
  publish("video.stats.updated", {
    type: "video.stats.updated",
    payload: { videoId, ...stats, timestamp: new Date().toISOString() }
  });
}

export function emitVideoViewed(videoId: string, userId: string) {
  publish("video.viewed", {
    type: "video.viewed",
    payload: { videoId, userId, timestamp: new Date().toISOString() }
  });
}

// Ensure connection starts
connectRabbitMQ();
