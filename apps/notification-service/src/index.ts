import { config } from "dotenv";
import { join } from "path";

// Load .env from monorepo root
config({ path: join(process.cwd(), "../../.env") });
import express from "express";
import cors from "cors";
import { serverEnv } from "@repo/config";
import { createServer } from "http";
import { connectRabbitMQ } from "./lib/rabbitmq.js";
import { initSocket } from "./gateways/socket.js";
import { startNotificationConsumer } from "./consumers/notification.js";

const app = express();
const PORT = process.env.PORT || 4011;

// CORS config - use env var in production
const corsOptions = {
  origin: serverEnv.ALLOWED_ORIGINS?.split(',') || true,
  credentials: true,
};
app.use(cors(corsOptions));
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

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received");
  httpServer.close(() => {
    process.exit(0);
  });
});
