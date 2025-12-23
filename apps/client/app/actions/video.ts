"use server";

import { videoService } from "@/lib/service-client";
import { revalidatePath } from "next/cache";

export async function getVideo(videoId: string) {
  console.log(`[Action:getVideo] Fetching video ${videoId}`);
  const result = await videoService.get(videoId);
  if (!result.success) {
      console.error(`[Action:getVideo] Failed:`, result.error);
  }
  return result;
}

export async function getMyVideos(params?: { limit?: number; cursor?: string; status?: string }) {
  return await videoService.getMyVideos(params);
}

export async function updateVideo(videoId: string, data: {
  title?: string;
  description?: string;
  tags?: string[];
  thumbnailUrl?: string;
  visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED" | "SCHEDULED";
  allowComments?: boolean;
  allowEmbedding?: boolean;
  isAgeRestricted?: boolean;
}) {
  const result = await videoService.update(videoId, data);
  if (result.success) {
    revalidatePath(`/studio/video/${videoId}`);
    revalidatePath(`/watch/${videoId}`);
    revalidatePath("/studio/content"); 
  }
  return result;
}

export async function deleteVideo(videoId: string) {
  const result = await videoService.delete(videoId);
  if (result.success) {
    revalidatePath("/studio/content");
  }
  return result;
}

export async function publishVideo(videoId: string, data: { 
  visibility: "PUBLIC" | "UNLISTED" | "SCHEDULED"; 
  scheduledAt?: Date 
}) {
  const result = await videoService.publish(videoId, data);
  if (result.success) {
    revalidatePath(`/studio/video/${videoId}`);
    revalidatePath(`/watch/${videoId}`);
    revalidatePath("/studio/content");
  }
  return result;
}

export async function initiateVideoUpload(filename: string) {
  return await videoService.initiateUpload(filename);
}

export async function completeVideoUpload(videoId: string) {
  const result = await videoService.completeUpload(videoId);
  if (result.success) {
    revalidatePath(`/studio/content`);
  }
  return result;
}
