import amqp, { Channel, Connection, ConsumeMessage } from "amqplib";
import {
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS,
  VideoUploadedEvent,
  VideoTranscodingStartedEvent,
  VideoTranscodingCompletedEvent,
  VideoTranscodingFailedEvent,
} from "@repo/events";
import path from "path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";

import { transcodingQueue } from "./queue.js";

let channel: Channel;
let connection: any;

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";

export const startConsumer = async () => {
  try {
    console.log("Connecting to RabbitMQ...");
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Assert Exchange and Queue
    await channel.assertExchange(EXCHANGES.VIDEO, "topic", { durable: true });
    await channel.assertQueue(QUEUES.VIDEO_TRANSCODE, { durable: true });
    
    // Bind Queue
    await channel.bindQueue(EXCHANGES.VIDEO, QUEUES.VIDEO_TRANSCODE, ROUTING_KEYS.VIDEO_UPLOADED);

    console.log("Waiting for messages in %s. To exit press CTRL+C", QUEUES.VIDEO_TRANSCODE);

    channel.consume(QUEUES.VIDEO_TRANSCODE, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      const content = JSON.parse(msg.content.toString()) as VideoUploadedEvent;
      console.log("Received message:", content);

      // Verify event type
      if (content.type !== "video.uploaded") {
        console.warn("Unknown event type:", content.type);
        channel.ack(msg);
        return;
      }

      const { videoId, fileName } = content.payload;
      
      try {
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
        console.error("Failed to queue job:", error);
        // Nack to retry later if queue is down
        channel.nack(msg);
      }
    });

  } catch (error) {
    console.error("Failed to start consumer:", error);
    process.exit(1);
  }
};

const publishEvent = async <T>(exchange: string, routingKey: string, event: T) => {
  if (!channel) return;
  channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(event)));
  console.log(`Published event: ${routingKey}`);
};
