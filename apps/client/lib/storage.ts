import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { serverEnv } from "@repo/config";

const BUCKET_NAME = serverEnv.MINIO_BUCKET || "play-videos";
const MINIO_PUBLIC_URL = process.env.NEXT_PUBLIC_MINIO_URL || `http://localhost:${serverEnv.MINIO_PORT}`;

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
  
  // Construct the permanent public URL
  const publicUrl = `${MINIO_PUBLIC_URL}/${BUCKET_NAME}/${key}`;
  
  return { uploadUrl: url, publicUrl };
};

/**
 * Upload file buffer directly to MinIO
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    },
  });

  await upload.done();
  
  // Return public URL
  return `${MINIO_PUBLIC_URL}/${BUCKET_NAME}/${key}`;
}

/**
 * Upload avatar image and return public URL
 */
export async function uploadAvatar(
  userId: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const extension = contentType.split("/")[1] || "jpg";
  const key = `avatars/${userId}-${Date.now()}.${extension}`;
  
  return uploadFile(buffer, key, contentType);
}

/**
 * Upload channel avatar and return public URL
 */
export async function uploadChannelAvatar(
  channelId: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const extension = contentType.split("/")[1] || "jpg";
  const key = `channels/${channelId}/avatar-${Date.now()}.${extension}`;
  
  return uploadFile(buffer, key, contentType);
}

/**
 * Upload channel banner and return public URL
 */
export async function uploadChannelBanner(
  channelId: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const extension = contentType.split("/")[1] || "jpg";
  const key = `channels/${channelId}/banner-${Date.now()}.${extension}`;
  
  return uploadFile(buffer, key, contentType);
}
