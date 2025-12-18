import { prisma } from "@repo/database";
import { meili, INDEX_VIDEOS, configureMeili } from "../lib/meili.js";

async function main() {
  console.log("🔄 Starting Full Re-Index...");
  
  // Ensure settings are applied first
  await configureMeili();

  const BATCH_SIZE = 500;
  let hasMore = true;
  let cursor: string | undefined = undefined;
  let totalIndexed = 0;

  const index = meili.index(INDEX_VIDEOS);

  // Clear existing index? (Optional, maybe safer to overwrite)
  // await index.deleteAllDocuments(); 

  while (hasMore) {
    // Fetch batch
    const videos: any[] = await prisma.video.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        processingStatus: "READY",
        visibility: "PUBLIC",
        deletedAt: null
      },
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        channelId: true,
        channelName: true,
        channelAvatarUrl: true, // Useful for UI
        thumbnailUrl: true,
        duration: true,
        viewCount: true,
        likeCount: true,
        createdAt: true,
        visibility: true,
        categoryId: true,
        processingStatus: true
      },
      orderBy: { id: "asc" }
    });

    if (videos.length === 0) {
      hasMore = false;
      break;
    }

    // Map to Meilisearch Documents
    const documents = videos.map((v: any) => ({
      ...v,
      // Ensure BigInts are strings or numbers (Meili supports numbers, but BigInt in JS needs conversion)
      viewCount: Number(v.viewCount), 
      createdAt: v.createdAt.getTime(), // Unix timestamp for sorting
    }));

    // Send to Meili
    const task = await index.addDocuments(documents);
    console.log(`Submitted batch of ${documents.length}. Task UID: ${task.taskUid}`);

    totalIndexed += documents.length;
    cursor = videos[videos.length - 1].id;
    
    if (videos.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log(`✅ Indexed ${totalIndexed} videos successfully.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
