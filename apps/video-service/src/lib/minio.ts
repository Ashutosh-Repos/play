// MinIO client for video storage
import { Client } from "minio";
import { config } from "../config.js";

export const minioClient = new Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

const BUCKET = config.minio.bucket;

/**
 * Ensure bucket exists
 */
export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
    console.log(`📦 Created MinIO bucket: ${BUCKET}`);
  }

  // Set Bucket Policy for Public Read on videos/* (HLS artifacts)
  // This is required for HLS playback without signed cookies/proxies
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${BUCKET}/videos/*`],
      },
    ],
  };

  try {
    await minioClient.setBucketPolicy(BUCKET, JSON.stringify(policy));
    console.log("🔓 Set public read policy for videos/*");
  } catch (err) {
    console.error("Failed to set bucket policy:", err);
  }
}

/**
 * Generate presigned PUT URL for video upload
 * Path format: uploads/{videoId}/original
 */
export async function getPresignedUploadUrl(videoId: string): Promise<string> {
  const objectPath = `uploads/${videoId}/original`;
  const expiry = config.upload.presignedUrlExpiry;
  
  const url = await minioClient.presignedPutObject(BUCKET, objectPath, expiry);
  return url;
}

/**
 * Check if object exists
 */
export async function objectExists(path: string): Promise<boolean> {
  try {
    await minioClient.statObject(BUCKET, path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get object metadata
 */
export async function getObjectStat(path: string) {
  return minioClient.statObject(BUCKET, path);
}

/**
 * Delete object
 */
export async function deleteObject(path: string): Promise<void> {
  await minioClient.removeObject(BUCKET, path);
}

/**
 * Delete all objects with prefix
 */
export async function deleteObjectsWithPrefix(prefix: string): Promise<void> {
  const objects = minioClient.listObjects(BUCKET, prefix, true);
  const objectsToDelete: string[] = [];
  
  for await (const obj of objects) {
    objectsToDelete.push(obj.name);
  }
  
  if (objectsToDelete.length > 0) {
    await minioClient.removeObjects(BUCKET, objectsToDelete);
  }
}

/**
 * Get video path from videoId
 */
export function getVideoPath(videoId: string): string {
  return `uploads/${videoId}/original`;
}

/**
 * Extract videoId from MinIO object path
 */
export function extractVideoIdFromPath(path: string): string | null {
  const match = path.match(/^uploads\/([^/]+)\/original$/);
  return match ? match[1] ?? null : null;
}
