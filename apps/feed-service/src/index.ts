import { config } from "dotenv";
import { join } from "path";

// Load .env from monorepo root
config({ path: join(process.cwd(), "../../.env") });

// BigInt JSON serialization fix
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

import express from "express";
import cors from "cors";
import { connectRabbitMQ } from "./lib/rabbitmq.js";
import { startHistoryConsumer } from "./consumers/history.js";
import { redis } from "./lib/redis.js";
import { startTrendingJob } from "./jobs/trending.js";

const app = express();
const PORT = process.env.PORT || 4010;

app.use(cors());
app.use(express.json());

import feedRoutes from "./routes/feed.js";

app.use("/api/feed", feedRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "feed-service" });
});

// Start Server
app.listen(PORT, async () => {
  console.log(`🚀 Feed Service running on port ${PORT}`);

  // Connect to Infra
  try {
      const channel = await connectRabbitMQ();
      await startHistoryConsumer(channel);
      
      // Check Redis
      await redis.ping();
      
      // Start Background Jobs
      startTrendingJob();
  } catch (err) {
      console.error("Failed to initialize feed service infra:", err);
  }
});
