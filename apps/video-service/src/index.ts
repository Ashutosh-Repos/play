// Video Service - Entry point
import express from "express";
import http from "http";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import videosRouter from "./routes/videos.js";
import uploadRouter from "./routes/upload.js";
import internalRouter from "./routes/internal.js";
import s3EventsRouter from "./routes/s3-events.js";
import playlistsRouter from "./routes/playlists.js";
import categoriesRouter from "./routes/categories.js";
import { connectRabbitMQ, closeRabbitMQ } from "./events/publisher.js";
import { startConsumer, stopConsumer } from "./events/consumer.js";
import { ensureBucket } from "./lib/minio.js";
import { redis } from "./lib/redis.js";
import { setupWebSocket } from "./ws/server.js";
import { startBackgroundJobs, stopBackgroundJobs } from "./jobs/background.js";

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMIT", message: "Too many requests" } },
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMIT", message: "Too many requests" } },
});

// Apply rate limiting
app.use("/videos", generalLimiter);
app.use("/playlists", generalLimiter);
app.use("/categories", generalLimiter);
app.use("/videos/upload", strictLimiter);
app.use("/videos/:id/publish", strictLimiter);

// Routes
app.use("/videos/upload", uploadRouter); // Upload routes (before general videos)
app.use("/videos", videosRouter);
app.use("/playlists", playlistsRouter);
app.use("/categories", categoriesRouter);
app.use("/internal/videos", internalRouter);
app.use("/internal/s3-events", s3EventsRouter); // MinIO webhook

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "video-service" });
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully...`);
  
  // Stop background jobs
  stopBackgroundJobs();
  
  // Close RabbitMQ
  await stopConsumer();
  await closeRabbitMQ();
  
  // Close Redis connections
  await redis.quit();
  
  // Close HTTP server
  server.close(() => {
    console.log("👋 video-service stopped");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start server
async function start() {
  try {
    // Ensure MinIO bucket exists
    await ensureBucket();
    console.log("📦 MinIO bucket ready");
    
    // Connect to RabbitMQ
    await connectRabbitMQ();
    console.log("🐰 RabbitMQ connected");
    
    // Start event consumer (for transcoder events)
    await startConsumer();
    console.log("📥 Event consumer started");
    
    // Setup WebSocket server
    setupWebSocket(server);
    console.log("🔌 WebSocket server ready");
    
    // Start background jobs
    startBackgroundJobs();
    console.log("🔄 Background jobs started");

    server.listen(config.port, () => {
      console.log(`🚀 video-service running on port ${config.port}`);
    });
  } catch (error) {
    console.error("❌ Failed to start video-service:", error);
    process.exit(1);
  }
}

start();
