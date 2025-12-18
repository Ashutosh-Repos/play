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

export const uploadArtifacts = async (videoId: string, artifactDir: string): Promise<string[]> => {
  console.log(`Uploading artifacts for ${videoId} from ${artifactDir}...`);
  
  const files = await fs.readdir(artifactDir);
  const uploadedUrls: string[] = [];

  for (const file of files) {
    const filePath = path.join(artifactDir, file);
    const fileStream = fs.createReadStream(filePath);
    
    // Key structure: videos/{videoId}/hls/{filename}
    // Note: We are keeping the 'hls' prefix for legacy reasons or we could rename to 'processed'
    // But since the plan mentioned videos/<id>/hls/, we stick to it or generalize.
    // Let's generalize to just videos/{videoId}/{filename} if we want, OR keep it under hls/ for now.
    // IMPORTANT: video-service expects hlsPlaylistUrl.
    // If we put thumbnails in the same dir, they will be videos/{videoId}/hls/thumbnail-1.png
    // This is fine.
    
    const key = `videos/${videoId}/hls/${file}`;
    
    // Determine content type
    let contentType = "application/octet-stream";
    if (file.endsWith(".m3u8")) contentType = "application/vnd.apple.mpegurl";
    if (file.endsWith(".ts")) contentType = "video/MP2T";
    if (file.endsWith(".png")) contentType = "image/png";
    if (file.endsWith(".jpg") || file.endsWith(".jpeg")) contentType = "image/jpeg";

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: VIDEO_BUCKET,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
      },
    });

    await upload.done();
    uploadedUrls.push(key);
  }

  console.log(`Uploaded ${files.length} artifacts for ${videoId}`);
  return uploadedUrls;
};
