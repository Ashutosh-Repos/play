import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs-extra";
import path from "path";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";

import { serverEnv } from "@repo/config";

const s3Client = new S3Client({
  region: "us-east-1", // MinIO doesn't care much about region usually
  endpoint: `http://${serverEnv.MINIO_ENDPOINT}:${serverEnv.MINIO_PORT}`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: serverEnv.MINIO_ACCESS_KEY,
    secretAccessKey: serverEnv.MINIO_SECRET_KEY,
  },
});

const VIDEO_BUCKET = serverEnv.MINIO_BUCKET;

/**
 * Download video from MinIO/S3
 */
export const downloadVideo = async (fileKey: string, downloadPath: string): Promise<void> => {
  console.log(`Downloading ${fileKey} to ${downloadPath}...`);
  
  // Ensure directory exists
  await fs.ensureDir(path.dirname(downloadPath));

  const command = new GetObjectCommand({
    Bucket: VIDEO_BUCKET,
    Key: fileKey,
  });

  const response = await s3Client.send(command);
  
  if (!response.Body) {
    throw new Error(`Failed to download file: ${fileKey}`);
  }

  await pipeline(response.Body as any, createWriteStream(downloadPath));
  console.log(`Downloaded ${fileKey}`);
};

/**
 * Get content type based on file extension
 */
function getContentType(filename: string): string {
  if (filename.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (filename.endsWith(".ts")) return "video/MP2T";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

/**
 * Upload a single file to MinIO/S3
 */
async function uploadFile(localPath: string, s3Key: string): Promise<string> {
  const fileStream = fs.createReadStream(localPath);
  const contentType = getContentType(path.basename(localPath));
  
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: VIDEO_BUCKET,
      Key: s3Key,
      Body: fileStream,
      ContentType: contentType,
    },
  });

  await upload.done();
  return s3Key;
}

/**
 * Upload thumbnails only - called early in the pipeline
 * Returns list of S3 keys for uploaded thumbnails
 */
export const uploadThumbnails = async (
  videoId: string, 
  artifactDir: string, 
  thumbnailFilenames: string[]
): Promise<string[]> => {
  console.log(`Uploading ${thumbnailFilenames.length} thumbnails for ${videoId}...`);
  
  const uploadedKeys: string[] = [];

  for (const filename of thumbnailFilenames) {
    const filePath = path.join(artifactDir, filename);
    
    // Skip if file doesn't exist
    if (!await fs.pathExists(filePath)) {
      console.warn(`Thumbnail not found: ${filePath}`);
      continue;
    }
    
    const key = `videos/${videoId}/hls/${filename}`;
    await uploadFile(filePath, key);
    uploadedKeys.push(key);
  }

  console.log(`Uploaded ${uploadedKeys.length} thumbnails for ${videoId}`);
  return uploadedKeys;
};

/**
 * Upload artifacts with optional extension filter
 * Used to upload HLS files after transcoding (excluding already-uploaded thumbnails)
 */
export const uploadArtifacts = async (
  videoId: string, 
  artifactDir: string,
  extensionFilter?: string[]  // e.g. [".m3u8", ".ts"] to only upload HLS files
): Promise<string[]> => {
  console.log(`Uploading artifacts for ${videoId} from ${artifactDir}...`);
  
  const files = await fs.readdir(artifactDir);
  const uploadedKeys: string[] = [];

  for (const file of files) {
    // Apply extension filter if provided
    if (extensionFilter && extensionFilter.length > 0) {
      const ext = path.extname(file).toLowerCase();
      if (!extensionFilter.includes(ext)) {
        continue; // Skip files not matching filter
      }
    }
    
    const filePath = path.join(artifactDir, file);
    const key = `videos/${videoId}/hls/${file}`;
    
    await uploadFile(filePath, key);
    uploadedKeys.push(key);
  }

  console.log(`Uploaded ${uploadedKeys.length} artifacts for ${videoId}`);
  return uploadedKeys;
};
