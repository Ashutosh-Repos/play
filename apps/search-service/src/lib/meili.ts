import { MeiliSearch } from "meilisearch";
import { serverEnv } from "@repo/config";

// The Meilisearch client
// In docker-compose, MEILISEARCH_URL=http://meilisearch:7700
// Key is MEILISEARCH_KEY=play-search-key
export const meili = new MeiliSearch({
  host: process.env.MEILISEARCH_URL || "http://localhost:7700",
  apiKey: process.env.MEILISEARCH_KEY || "play-search-key",
});

export const INDEX_VIDEOS = "videos";
export const INDEX_CHANNELS = "channels";

// Initialize Index Settings (Searchable fields, etc.)
export async function configureMeili() {
  try {
    // --- Videos Index ---
    const videos = meili.index(INDEX_VIDEOS);
    console.log("⚙️ Configuring Meilisearch 'videos' Index...");
    await videos.updateFilterableAttributes([
        "visibility", 
        "channelId", 
        "tags", 
        "categoryId",
        "processingStatus"
    ]);
    await videos.updateSortableAttributes(["createdAt", "viewCount", "likeCount"]);
    await videos.updateSearchableAttributes(["title", "description", "tags", "channelName"]);
    await videos.updateRankingRules([
        "words", "typo", "proximity", "attribute", "sort", "exactness",
        "viewCount:desc"
    ]);

    // --- Channels Index ---
    const channels = meili.index(INDEX_CHANNELS);
    console.log("⚙️ Configuring Meilisearch 'channels' Index...");
    await channels.updateFilterableAttributes(["isVerified"]);
    await channels.updateSortableAttributes(["createdAt", "subscriberCount"]);
    await channels.updateSearchableAttributes(["handle", "displayName", "description"]);
    await channels.updateRankingRules([
        "words", "typo", "proximity", "attribute", "sort", "exactness",
        "subscriberCount:desc" // Boost popular channels
    ]);

    console.log("✅ Meilisearch Configured!");
  } catch (error) {
    console.error("❌ Failed to configure Meilisearch:", error);
    throw error;
  }
}
