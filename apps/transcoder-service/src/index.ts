import express from "express";
import { startConsumer } from "./consumer.js";
import { startWorker } from "./worker.js";

const app = express();
const PORT = process.env.PORT || 4005;

app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "transcoder-service" }));

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
