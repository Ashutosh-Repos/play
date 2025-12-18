import amqp from "amqplib";

let connection: any; // Using any to bypass stubborn type issues
let channel: amqp.Channel;

export const connectRabbitMQ = async () => {
  if (connection) return channel;

  try {
    connection = (await amqp.connect(process.env.RABBITMQ_URL || "amqp://play:play123@localhost:5672")) as any;
    channel = await connection.createChannel();
    console.log("✅ RabbitMQ Connected (Notification Service)");
    return channel;
  } catch (error) {
    console.error("❌ RabbitMQ Connection Error:", error);
    throw error;
  }
};
