import { z } from "zod";

/**
 * Server-side environment variables schema
 * These are NOT exposed to the browser
 * Used by: Next.js server components, API routes, and all microservices
 */
const serverEnvSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database (PostgreSQL)
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://play:play123@localhost:5432/play"),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // RabbitMQ
  RABBITMQ_URL: z.string().default("amqp://play:play123@localhost:5672"),

  // MinIO / S3
  MINIO_ENDPOINT: z.string().default("localhost"),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default("playadmin"),
  MINIO_SECRET_KEY: z.string().default("playadmin123"),
  MINIO_BUCKET: z.string().default("play-videos"),
  MINIO_USE_SSL: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  S3_WEBHOOK_SECRET: z.string().default("play-webhook-secret"),

  // Meilisearch
  MEILISEARCH_URL: z.string().url().default("http://localhost:7700"),
  MEILISEARCH_KEY: z.string().default("play-search-key"),

  // ClickHouse (Optional - can be removed if not used)
  CLICKHOUSE_URL: z.string().default("http://localhost:8123").optional(),
  CLICKHOUSE_USER: z.string().default("play").optional(),
  CLICKHOUSE_PASSWORD: z.string().default("play123").optional(),

  // JWT / Auth
  JWT_SECRET: z.string().min(16).default("VbyFelqTxFcsNxBWSyvptR6Sf2RPKtxl9eLVHex1lIk="),
  JWT_EXPIRES_IN: z.string().default("7d"),
  AUTH_SECRET: z.string().min(16).default("VbyFelqTxFcsNxBWSyvptR6Sf2RPKtxl9eLVHex1lIk="),
  NEXTAUTH_SECRET: z.string().default("VbyFelqTxFcsNxBWSyvptR6Sf2RPKtxl9eLVHex1lIk="),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  
  // Internal service-to-service auth
  INTERNAL_SERVICE_SECRET: z.string().default("internal-service-secret-key-for-dev"),

  // CORS - comma-separated origins, empty means allow all in dev
  ALLOWED_ORIGINS: z.string().optional(),

  // Service ports (optional, services can use defaults)
  PORT: z.coerce.number().optional(),
  
  // Service URLs (for client-to-service communication)
  USER_SERVICE_URL: z.string().default("http://localhost:4001").optional(),
  VIDEO_SERVICE_URL: z.string().default("http://localhost:4003").optional(),
  ENGAGEMENT_SERVICE_URL: z.string().default("http://localhost:4006").optional(),
  SEARCH_SERVICE_URL: z.string().default("http://localhost:4009").optional(),
  FEED_SERVICE_URL: z.string().default("http://localhost:4010").optional(),
  NOTIFICATION_SERVICE_URL: z.string().default("http://localhost:4011").optional(),
  
  // Optional: Email/SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  
  // Optional: OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  
  // Optional: FFmpeg (for transcoder)
  FFMPEG_THREADS: z.coerce.number().default(4).optional(),
});

// Parse environment variables - will throw if validation fails
function getServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid server environment variables:");
    console.error(parsed.error.flatten().fieldErrors);

    // In development, continue with defaults. In production, crash.
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid environment variables");
    }

    // Return defaults for development
    return serverEnvSchema.parse({});
  }

  return parsed.data;
}

export const serverEnv = getServerEnv();
export type ServerEnv = z.infer<typeof serverEnvSchema>;
