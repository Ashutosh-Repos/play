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



// Initialize Index Settings (Searchable fields, etc.)
export async function configureMeili() {
  try {
    const index = meili.index(INDEX_VIDEOS);
    
    // Create index if not exists (lazy check)
    // Actually, updateSettings will create it if needed usually, or we can use getOrCreateIndex
    
    console.log("⚙️ Configuring Meilisearch Index...");
    
    await index.updateFilterableAttributes([
        "visibility", 
        "channelId", 
        "tags", 
        "categoryId",
        "processingStatus"
    ]);

    await index.updateSortableAttributes([
        "createdAt", 
        "viewCount",
        "likeCount"
    ]);

    await index.updateSearchableAttributes([
        "title",
        "description",
        "tags",
        "channelName"
    ]);
    
    // Custom Ranking: Popularity (viewCount) matters
    await index.updateRankingRules([
        "words",
        "typo",
        "proximity",
        "attribute",
        "sort",
        "exactness",
        "viewCount:desc" // Custom rule: Boost popular videos
    ]);

    console.log("✅ Meilisearch Configured!");
  } catch (error) {
    console.error("❌ Failed to configure Meilisearch:", error);
    throw error;
  }
}
