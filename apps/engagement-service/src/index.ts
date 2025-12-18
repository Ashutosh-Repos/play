import express from "express";
import cors from "cors";
import { serverEnv } from "@repo/config";
import { redis } from "./lib/redis.js";
import { startBackgroundJobs } from "./jobs/worker.js";

const app = express();
const PORT = process.env.PORT || 4006;

app.use(cors());
app.use(express.json());

import reactionRouter from "./routes/reaction.js";
import commentRouter from "./routes/comment.js";
import viewRouter from "./routes/view.js";

app.use("/api", reactionRouter);
app.use("/api", commentRouter);
app.use("/api", viewRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "engagement-service" });
});

// Start server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Engagement Service running on port ${PORT}`);
  
  // Test Redis connection
  try {
    const start = Date.now();
    await redis.ping();
    console.log(`Redis connected in ${Date.now() - start}ms`);
    
    startBackgroundJobs();
  } catch (err) {
    console.error("Failed to connect to Redis on startup", err);
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
