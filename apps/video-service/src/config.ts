// Config - re-export from @repo/config
import { serverEnv } from "@repo/config";

export const config = {
  port: serverEnv.PORT || 4003,
  
  // Database
  databaseUrl: serverEnv.DATABASE_URL,
  
  // Redis
  redisUrl: serverEnv.REDIS_URL,
  
  // RabbitMQ
  rabbitmqUrl: serverEnv.RABBITMQ_URL,
  
  // MinIO
  minio: {
    endpoint: serverEnv.MINIO_ENDPOINT,
    port: serverEnv.MINIO_PORT,
    accessKey: serverEnv.MINIO_ACCESS_KEY,
    secretKey: serverEnv.MINIO_SECRET_KEY,
    bucket: serverEnv.MINIO_BUCKET,
    useSSL: serverEnv.MINIO_USE_SSL,
  },
  
  // JWT
  jwtSecret: serverEnv.JWT_SECRET,
  
  // CORS
  allowedOrigins: serverEnv.ALLOWED_ORIGINS?.split(',') || null,
  
  // Upload settings
  upload: {
    maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
    allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
    presignedUrlExpiry: 60 * 60, // 1 hour
    staleUploadThreshold: 2 * 60 * 60 * 1000, // 2 hours in ms
  },
};

export type Config = typeof config;
