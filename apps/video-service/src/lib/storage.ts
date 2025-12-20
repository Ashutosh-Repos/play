import { S3Client, CreateBucketCommand, HeadBucketCommand, HeadObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
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
 * Ensure the video bucket exists
 */
export const ensureBucket = async () => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        try {
            await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
            console.log(`Bucket ${BUCKET_NAME} created`);
        } catch (createErr) {
            console.error("Failed to create bucket:", createErr);
        }
    } else {
        console.error("Error checking bucket:", err);
    }
  }
};

/**
 * Get path for raw video upload
 */
export const getVideoPath = (videoId: string): string => {
  return `uploads/${videoId}/original`;
};

/**
 * Extract video ID from object path
 * Pattern: uploads/{videoId}/original
 */
export const extractVideoIdFromPath = (path: string): string | null => {
  const match = path.match(/^uploads\/([^/]+)\/original$/);
  return match?.[1] ?? null;
};

/**
 * Generate presigned URL for upload (PUT)
 * using @aws-sdk/s3-request-presigner
 */
export const getPresignedUploadUrl = async (videoId: string, expirySeconds = 3600): Promise<string> => {
  const key = getVideoPath(videoId);
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  
  // @ts-ignore - AWS SDK type mismatch
  return await getSignedUrl(s3Client, command, { expiresIn: expirySeconds });
};

/**
 * Check if object exists
 */
export const objectExists = async (key: string): Promise<boolean> => {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return true;
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
};

/**
 * Get object stats
 */
export const getObjectStat = async (key: string) => {
  const result = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
  return {
      size: result.ContentLength || 0,
      lastModified: result.LastModified,
      etag: result.ETag,
  };
};

/**
 * Delete objects with prefix
 * Note: S3 doesn't support delete by prefix directly, need to list then delete
 */
export const deleteObjectsWithPrefix = async (prefix: string) => {
  try {
      // List objects
      const listCommand = new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
      });
      const listResult = await s3Client.send(listCommand);
      
      if (!listResult.Contents || listResult.Contents.length === 0) return;
      
      const objectsToDelete = listResult.Contents.map(obj => ({ Key: obj.Key }));
      
      // Delete objects
      const deleteCommand = new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: {
              Objects: objectsToDelete,
              Quiet: true
          }
      });
      
      await s3Client.send(deleteCommand);
  } catch (err) {
      console.error("Error deleting objects with prefix:", prefix, err);
  }
};
