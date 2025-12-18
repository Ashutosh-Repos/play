import express from "express";
import cors from "cors";
import { createServer } from "http";
import { connectRabbitMQ } from "./lib/rabbitmq.js";
import { initSocket } from "./gateways/socket.js";
import { startNotificationConsumer } from "./consumers/notification.js";

const app = express();
const PORT = process.env.PORT || 4011;

app.use(cors());
app.use(express.json());

import notificationRoutes from "./routes/notification.js";

app.use("/api/notifications", notificationRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "notification-service" });
});

// Create HTTP Server for Socket.io
const httpServer = createServer(app);

// Init Socket
initSocket(httpServer);

// Start Server
httpServer.listen(PORT, async () => {
  console.log(`🚀 Notification Service running on port ${PORT}`);

  try {
      const channel = await connectRabbitMQ();
      await startNotificationConsumer(channel);
  } catch (err) {
      console.error("Failed to init infra:", err);
  }
});
