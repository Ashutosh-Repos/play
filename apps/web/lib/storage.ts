import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv } from "@repo/config";

const BUCKET_NAME = serverEnv.MINIO_BUCKET || "play-videos";

const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: `http://${serverEnv.MINIO_ENDPOINT}:${serverEnv.MINIO_PORT}`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: serverEnv.MINIO_ACCESS_KEY,
    secretAccessKey: serverEnv.MINIO_SECRET_KEY,
  },
});

/**
 * Generate presigned URL for avatar upload (PUT)
 */
export const getPresignedAvatarUploadUrl = async (userId: string, contentType: string, expirySeconds = 600) => {
  const extension = contentType.split("/")[1] || "jpg";
  const key = `avatars/${userId}-${Date.now()}.${extension}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  
  // @ts-ignore - AWS SDK type mismatch known issue
  const url = await getSignedUrl(s3Client, command, { expiresIn: expirySeconds });
  
  // Return the full public URL (accessible from browser)
  // For MinIO/Localhost, we might need to adjust the hostname if running in Docker
  // But for now, let's assume the signed URL is usable or we construct the public URL manually
  
  // Construct the permanent public URL
  // If local, usually http://localhost:9000/bucket/key
  const publicUrl = `http://localhost:${serverEnv.MINIO_PORT}/${BUCKET_NAME}/${key}`;
  
  return { uploadUrl: url, publicUrl };
};
