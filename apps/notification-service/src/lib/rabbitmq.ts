import amqp from "amqplib";
import { serverEnv } from "@repo/config";

let connection: any; // Using any due to @types/amqplib mismatch
let channel: amqp.Channel | null = null;
let isReconnecting = false;

const RABBITMQ_URL = serverEnv.RABBITMQ_URL;

export const connectRabbitMQ = async (): Promise<amqp.Channel> => {
  if (channel) return channel;

  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    
    // Handle connection close - attempt reconnect
    connection.on("close", () => {
      if (!isReconnecting) {
        console.warn("⚠️ RabbitMQ connection closed, reconnecting in 5s...");
        isReconnecting = true;
        channel = null;
        connection = null;
        setTimeout(async () => {
          try {
            await connectRabbitMQ();
            isReconnecting = false;
          } catch (err) {
            console.error("❌ Reconnection failed:", err);
            isReconnecting = false;
          }
        }, 5000);
      }
    });

    connection.on("error", (err: Error) => {
      console.error("❌ RabbitMQ connection error:", err);
    });

    console.log("✅ RabbitMQ Connected (Notification Service)");
    return channel as amqp.Channel;
  } catch (error) {
    console.error("❌ RabbitMQ Connection Error:", error);
    throw error;
  }
};

export const getChannel = () => channel;
