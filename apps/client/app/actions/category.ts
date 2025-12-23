"use server";

import { categoryService } from "@/lib/service-client";

export async function getCategories() {
  return await categoryService.getAll();
}

export async function getCategory(slug: string) {
  return await categoryService.get(slug);
}

export async function getCategoryVideos(slug: string, params?: { limit?: number; cursor?: string; sort?: string }) {
  return await categoryService.getVideos(slug, params);
}
