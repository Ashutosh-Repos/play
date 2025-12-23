"use server";

import { engagementService } from "@/lib/service-client";
import { revalidatePath } from "next/cache";

export async function toggleReaction(videoId: string, type: "LIKE" | "DISLIKE") {
  const result = await engagementService.toggleReaction(videoId, type);
  if (!result.success) {
    console.error("[EngagementAction] toggleReaction failed:", result.error);
  }
  return result;
}

export async function getMyReaction(videoId: string) {
  return await engagementService.getMyReaction(videoId);
}

export async function recordView(videoId: string) {
  return await engagementService.recordView(videoId);
}

export async function getComments(videoId: string, params?: { limit?: number; cursor?: string; sort?: "NEWEST" | "POPULAR" }) {
  return await engagementService.getComments(videoId, params);
}

export async function postComment(videoId: string, content: string) {
  const result = await engagementService.postComment(videoId, content);
  if (result.success) {
      revalidatePath(`/watch/${videoId}`);
  } else {
    console.error("[EngagementAction] postComment failed:", result.error);
  }
  return result;
}

export async function deleteComment(commentId: string) {
    // We assume the user is authorized (service check)
    // We don't know the videoId easily to revalidate path perfectly without extra fetching, 
    // but the client updates optimistically anyway.
    return await engagementService.deleteComment(commentId);
}
