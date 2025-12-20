import { config } from "dotenv";
import { join } from "path";

// Load .env from monorepo root
config({ path: join(process.cwd(), "../../.env") });

import express from "express";
import cors from "cors";
import { serverEnv } from "@repo/config";
import { connectRabbitMQ } from "./lib/rabbitmq.js";
import { startHistoryConsumer } from "./consumers/history.js";
import { startVideoConsumer } from "./consumers/video.js";
import { redis } from "./lib/redis.js";
import { startTrendingJob } from "./jobs/trending.js";

const app = express();
const PORT = process.env.PORT || 4010;

// Custom JSON replacer for BigInt serialization
function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

// CORS config - use env var in production
const corsOptions = {
  origin: serverEnv.ALLOWED_ORIGINS?.split(',') || true,
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// Override res.json to handle BigInt serialization
app.use((_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    return originalJson(JSON.parse(JSON.stringify(body, bigIntReplacer)));
  };
  next();
});

import feedRoutes from "./routes/feed.js";

app.use("/api/feed", feedRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "feed-service" });
});

// Start Server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Feed Service running on port ${PORT}`);

  // Connect to Infra
  try {
      const channel = await connectRabbitMQ();
      await startHistoryConsumer(channel);
      await startVideoConsumer(channel);

      // Check Redis
      await redis.ping();

      // Start Background Jobs
      startTrendingJob();
  } catch (err) {
      console.error("Failed to initialize feed service infra:", err);
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received");
  server.close(() => {
    console.log("Server closed");
    redis.quit();
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received");
  server.close(() => {
    redis.quit();
    process.exit(0);
  });
});
