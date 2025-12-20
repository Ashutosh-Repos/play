import { config } from "dotenv";
import { join } from "path";

// Load .env from monorepo root
config({ path: join(process.cwd(), "../../.env") });
import express from "express";
import cors from "cors";
import { serverEnv } from "@repo/config";
import { configureMeili } from "./lib/meili.js";
import { connectRabbitMQ } from "./lib/rabbitmq.js";
import { startVideoConsumer } from "./consumers/video.js";

const app = express();
const PORT = process.env.PORT || 4009;

// CORS config - use env var in production
const corsOptions = {
  origin: serverEnv.ALLOWED_ORIGINS?.split(',') || true,
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

import searchRouter from "./routes/search.js";

app.use("/api", searchRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "search-service" });
});

// Start server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Search Service running on port ${PORT}`);
  
  // Configure Search Engine on startup
  await configureMeili();
  
  // Start Consumers
  try {
      const channel = await connectRabbitMQ();
      await startVideoConsumer(channel);
  } catch (err) {
      console.log("Failed to start consumers", err);
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
