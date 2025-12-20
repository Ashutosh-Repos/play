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

  // Meilisearch
  MEILISEARCH_URL: z.string().url().default("http://localhost:7700"),
  MEILISEARCH_KEY: z.string().default("play-search-key"),

  // ClickHouse
  CLICKHOUSE_URL: z.string().default("http://localhost:8123"),
  CLICKHOUSE_USER: z.string().default("play"),
  CLICKHOUSE_PASSWORD: z.string().default("play123"),

  // JWT / Auth
  JWT_SECRET: z.string().min(16).default("VbyFelqTxFcsNxBWSyvptR6Sf2RPKtxl9eLVHex1lIk="),
  JWT_EXPIRES_IN: z.string().default("7d"),
  AUTH_SECRET: z.string().min(16).default("VbyFelqTxFcsNxBWSyvptR6Sf2RPKtxl9eLVHex1lIk="),
  NEXTAUTH_SECRET: z.string().default("VbyFelqTxFcsNxBWSyvptR6Sf2RPKtxl9eLVHex1lIk="),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),

  // CORS - comma-separated origins, empty means allow all in dev
  ALLOWED_ORIGINS: z.string().optional(),

  // Service ports (optional, services can use defaults)
  PORT: z.coerce.number().optional(),
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
