"use server";

import { playlistService } from "@/lib/service-client";
import { revalidatePath } from "next/cache";

export async function getMyPlaylists(params?: { limit?: number; cursor?: string }) {
  return await playlistService.getMyPlaylists(params);
}

export async function getPlaylist(id: string) {
  return await playlistService.get(id);
}

export async function createPlaylist(data: { title: string; description?: string; visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED" }) {
  const result = await playlistService.create(data);
  if (result.success) {
    revalidatePath("/studio/playlists");
  }
  return result;
}

export async function updatePlaylist(id: string, data: { title?: string; description?: string; visibility?: string }) {
  const result = await playlistService.update(id, data);
  if (result.success) {
    revalidatePath("/studio/playlists");
    revalidatePath(`/studio/playlists/${id}`);
  }
  return result;
}

export async function deletePlaylist(id: string) {
  const result = await playlistService.delete(id);
  if (result.success) {
    revalidatePath("/studio/playlists");
  }
  return result;
}

export async function addVideoToPlaylist(playlistId: string, videoId: string) {
  const result = await playlistService.addVideo(playlistId, videoId);
  if (result.success) {
      revalidatePath(`/studio/playlists/${playlistId}`);
  }
  return result;
}

export async function removeVideoFromPlaylist(playlistId: string, videoId: string) {
  const result = await playlistService.removeVideo(playlistId, videoId);
  revalidatePath(`/studio/playlists/${playlistId}`);
  return result;
}

export async function reorderPlaylistVideos(playlistId: string, videoIds: string[]) {
  const result = await playlistService.reorderVideos(playlistId, videoIds);
  revalidatePath(`/studio/playlists/${playlistId}`);
  return result;
}
