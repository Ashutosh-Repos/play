// Load .env FIRST before any other imports
import { config } from "dotenv";
import { join } from "path";
config({ path: join(process.cwd(), "../../.env") });

// Now import everything else
import express from "express";
import { startConsumer, stopConsumer } from "./consumer.js";
import { startWorker, stopWorker } from "./worker.js";

const app = express();
const PORT = process.env.PORT || 4005;

app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "transcoder-service" }));

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully...`);
  
  try {
    // Stop accepting new jobs
    await stopConsumer();
    
    // Wait for in-flight jobs to complete (max 30 seconds)
    console.log("Waiting for worker to finish current jobs...");
    await stopWorker();
    
    console.log("👋 transcoder-service stopped");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

const start = async () => {
  try {
    await startWorker();
    await startConsumer();
    app.listen(PORT, () => console.log(`🚀 transcoder-service running on port ${PORT}`));
  } catch (err) {
    console.error("Failed to start service:", err);
    process.exit(1);
  }
};

start();
