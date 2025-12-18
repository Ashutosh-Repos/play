import amqp from "amqplib";
import { serverEnv } from "@repo/config";

let connection: any;
let channel: amqp.Channel;

export const connectRabbitMQ = async () => {
  if (connection) return channel;

  try {
    connection = (await amqp.connect(process.env.RABBITMQ_URL || "amqp://play:play123@localhost:5672")) as any;
    channel = await connection.createChannel();
    console.log("✅ RabbitMQ Connected (Search)");
    return channel;
  } catch (error) {
    console.error("❌ RabbitMQ Connection Error:", error);
    throw error;
  }
};

export const getChannel = () => {
    if (!channel) throw new Error("RabbitMQ not connected");
    return channel;
}
