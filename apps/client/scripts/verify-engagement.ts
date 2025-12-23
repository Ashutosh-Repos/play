
// Dedicated script to verify Engagement Service Health
// No imports from project files to avoid alias issues

async function main() {
  const ENGAGEMENT_URL = "http://localhost:4006";

  console.log(`Checking Engagement Service at ${ENGAGEMENT_URL}...`);

  try {
    const healthRes = await fetch(`${ENGAGEMENT_URL}/health`);
    if (healthRes.ok) {
        const data = await healthRes.json();
        console.log("✅ Engagement Service Health Check Passed:", data);
    } else {
        console.error("❌ Engagement Service Health Check Failed:", healthRes.status, healthRes.statusText);
    }
  } catch (error) {
    console.error("❌ Engagement Service Connection Failed:", error);
    console.log("Make sure the engagement-service is running on port 4006.");
    process.exit(1);
  }

  // Try to fetch comments for a dummy video (public endpoint?)
  try {
      console.log("Testing getComments (public)...");
      const commentsRes = await fetch(`${ENGAGEMENT_URL}/api/videos/dummy-video-id/comments`);
      if (commentsRes.ok) {
          const data = await commentsRes.json();
          console.log("✅ getComments Success:", data);
      } else {
          console.log("⚠️ getComments Failed (might need auth):", commentsRes.status, commentsRes.statusText);
          const errorText = await commentsRes.text();
          console.log("Error details:", errorText);
      }
  } catch (e) {
      console.error("❌ getComments Request Error:", e);
  }
}

main();
