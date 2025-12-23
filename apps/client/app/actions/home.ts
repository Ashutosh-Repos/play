"use server";

import { feedService, categoryService } from "@/lib/service-client";

export async function getFeed(params?: { limit?: number; cursor?: string; sort?: "latest" | "popular" }) {
  return await feedService.getHome(params);
}

export async function getCategories() {
  return await categoryService.getAll();
}

export async function getCategoryVideos(slug: string, params?: any) {
  return await categoryService.getVideos(slug, params);
}
