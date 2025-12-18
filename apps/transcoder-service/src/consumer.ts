import amqp, { Channel, ConsumeMessage } from "amqplib";
import {
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS,
  VideoUploadedEvent,
} from "@repo/events";
import { v4 as uuidv4 } from "uuid";

import { transcodingQueue, jobExistsForVideo } from "./queue.js";

let channel: Channel;
let connection: any = null;  // amqplib.Connection
let isShuttingDown = false;

// Read at runtime, not module load time
const getRabbitMQUrl = () => process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const RECONNECT_DELAY_MS = 5000;

/**
 * Connect to RabbitMQ with automatic reconnection
 */
async function connectWithRetry(): Promise<void> {
  while (!isShuttingDown) {
    try {
      console.log("Connecting to RabbitMQ...");
      connection = await amqp.connect(getRabbitMQUrl());
      
      // Handle connection close - trigger reconnection
      connection.on("close", () => {
        if (!isShuttingDown) {
          console.warn("RabbitMQ connection closed, reconnecting in", RECONNECT_DELAY_MS, "ms...");
          setTimeout(() => connectWithRetry(), RECONNECT_DELAY_MS);
        }
      });
      
      connection.on("error", (err: Error) => {
        console.error("RabbitMQ connection error:", err.message);
      });
      
      channel = await connection.createChannel();

      // Assert Exchange and Queue
      await channel.assertExchange(EXCHANGES.VIDEO, "topic", { durable: true });
      await channel.assertQueue(QUEUES.VIDEO_TRANSCODE, { durable: true });
      
      // Bind Queue
      await channel.bindQueue(QUEUES.VIDEO_TRANSCODE, EXCHANGES.VIDEO, ROUTING_KEYS.VIDEO_UPLOADED);

      console.log("✅ RabbitMQ connected. Waiting for messages in", QUEUES.VIDEO_TRANSCODE);
      
      // Start consuming
      channel.consume(QUEUES.VIDEO_TRANSCODE, handleMessage);
      
      break; // Connected successfully, exit retry loop
    } catch (error) {
      console.error("Failed to connect to RabbitMQ:", error);
      console.log(`Retrying in ${RECONNECT_DELAY_MS}ms...`);
      await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY_MS));
    }
  }
}

/**
 * Handle incoming RabbitMQ messages
 */
async function handleMessage(msg: ConsumeMessage | null): Promise<void> {
  if (!msg) return;

  try {
    const content = JSON.parse(msg.content.toString()) as VideoUploadedEvent;
    console.log("📥 Received message:", content.type);

    // Verify event type
    if (content.type !== "video.uploaded") {
      console.warn("Unknown event type:", content.type);
      channel.ack(msg);
      return;
    }

    const { videoId, fileName } = content.payload;
    
    // Deduplication: Check if job already exists for this video
    const jobExists = await jobExistsForVideo(videoId);
    if (jobExists) {
      console.log(`⚠️ Job already exists for video ${videoId}, skipping duplicate`);
      channel.ack(msg);
      return;
    }
    
    console.log(`Adding job for video ${videoId} to transcoding queue`);
    
    // Add to internal BullMQ queue
    const jobId = `${videoId}-${uuidv4()}`;
    await transcodingQueue.add(
      "transcode",
      { videoId, fileName },
      {
        jobId, // Unique per attempt
        removeOnComplete: true
      }
    );

    // Acknowledge the event immediately as we've safely queued it
    channel.ack(msg);
  } catch (error) {
    console.error("Failed to process message:", error);
    // Nack to retry later if queue is down
    channel.nack(msg);
  }
}

export const startConsumer = async (): Promise<void> => {
  await connectWithRetry();
};

/**
 * Graceful shutdown - close RabbitMQ connection
 */
export const stopConsumer = async (): Promise<void> => {
  isShuttingDown = true;
  
  if (channel) {
    try {
      await channel.close();
    } catch (err) {
      console.warn("Error closing channel:", err);
    }
  }
  
  if (connection) {
    try {
      await connection.close();
    } catch (err) {
      console.warn("Error closing connection:", err);
    }
  }
  
  console.log("👋 RabbitMQ consumer stopped");
};
