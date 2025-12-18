// User Service Entry Point
import { config } from "dotenv";
import { join } from "path";

// Load .env from monorepo root
config({ path: join(process.cwd(), "../../.env") });
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { prisma } from "@repo/database";

// Routes
import usersRouter from "./routes/users.js";
import channelsRouter from "./routes/channels.js";
import subscriptionsRouter from "./routes/subscriptions.js";
import accountRouter from "./routes/account.js";
import settingsRouter from "./routes/settings.js";
import adminRouter from "./routes/admin.js";

// Events
import { connectRabbitMQ } from "./events/publisher.js";
import { startConsumer } from "./events/consumer.js";

const app = express();
const PORT = process.env.PORT || 4001;

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many requests, please try again later" },
  },
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 requests per 15 min for sensitive operations
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many requests, please try again later" },
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Health check (no rate limit)
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "healthy", service: "user-service" });
  } catch (error) {
    res.status(503).json({ status: "unhealthy", error: "Database connection failed" });
  }
});

// API Routes with rate limiting
app.use("/api/v1/users", generalLimiter, usersRouter);
app.use("/api/v1/channels", generalLimiter, channelsRouter);
app.use("/api/v1/subscriptions", generalLimiter, subscriptionsRouter);
app.use("/api/v1/account", strictLimiter, accountRouter); // Stricter for account operations
app.use("/api/v1/settings", generalLimiter, settingsRouter);
app.use("/api/v1/admin", strictLimiter, adminRouter); // Stricter for admin operations

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: err.message || "Something went wrong" },
  });
});

// Start server
async function start() {
  try {
    // Connect to RabbitMQ
    await connectRabbitMQ();
    await startConsumer();

    app.listen(PORT, () => {
      console.log(`🚀 user-service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start user-service:", error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  start();
}

export default app;
