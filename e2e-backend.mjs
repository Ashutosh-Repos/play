#!/usr/bin/env node
/**
 * Comprehensive Backend-Only E2E Test
 * Tests all services by:
 * 1. Creating test user directly in DB
 * 2. Generating JWT for authentication
 * 3. Testing complete video upload → transcode → engagement flow
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
// Dynamic import for Prisma to work with ESM
const { PrismaClient } = await import("@prisma/client");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Prisma
const prisma = new PrismaClient();

// Service URLs
const SERVICES = {
  user: "http://localhost:4001",
  video: "http://localhost:4003",
  transcoder: "http://localhost:4005",
  engagement: "http://localhost:4006",
  search: "http://localhost:4009",
  feed: "http://localhost:4010",
  notification: "http://localhost:4011",
};

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || "development-secret-key";
const SAMPLE_VIDEO_PATH = path.join(__dirname, "sample-video.mp4");

// Test state
let testToken = "";
let testUserId = "";
let testChannelId = "";
let testVideoId = "";
let results = { passed: 0, failed: 0, skipped: 0 };

// Helpers
const log = (emoji, section, message) => console.log(`${emoji} [${section}] ${message}`);
const pass = (section, msg) => { results.passed++; log("✅", section, msg); };
const fail = (section, msg) => { results.failed++; log("❌", section, msg); };
const skip = (section, msg) => { results.skipped++; log("⏭️", section, msg); };
const info = (section, msg) => log("ℹ️", section, msg);

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(testToken ? { Authorization: `Bearer ${testToken}` } : {}),
        ...options.headers,
      },
    });
    const text = await res.text();
    try {
      return { ok: res.ok, status: res.status, data: JSON.parse(text) };
    } catch {
      return { ok: res.ok, status: res.status, data: text };
    }
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

// ===============================
// TEST FUNCTIONS
// ===============================

async function testHealthChecks() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  1. HEALTH CHECKS                                           ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  for (const [name, baseUrl] of Object.entries(SERVICES)) {
    const res = await fetchJson(`${baseUrl}/health`);
    const status = res.data?.status?.toLowerCase?.();
    if (res.ok && (status === "ok" || status === "healthy")) {
      pass("HEALTH", `${name}-service: OK`);
    } else {
      fail("HEALTH", `${name}-service: DOWN (${res.error || res.status})`);
    }
  }
}

async function setupTestUser() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  2. SETUP TEST USER (Database)                              ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const testEmail = `e2e_backend_${Date.now()}@test.com`;
  const testUsername = `e2e_user_${Date.now()}`;

  try {
    // Create user directly in database
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        username: testUsername,
        displayName: "E2E Test User",
        emailVerified: new Date(),
        status: "ACTIVE",
        role: "USER",
        channel: {
          create: {
            handle: testUsername,
            displayName: "E2E Test Channel",
          },
        },
      },
      include: {
        channel: true,
      },
    });

    testUserId = user.id;
    testChannelId = user.channel?.id || "";
    pass("USER", `Created user: ${testEmail} (ID: ${testUserId})`);
    pass("USER", `Created channel: ${testChannelId}`);

    // Generate JWT token
    testToken = jwt.sign(
      {
        sub: testUserId,
        email: testEmail,
        role: "USER",
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    pass("USER", "Generated JWT token");

    // Verify token works with user-service
    const profileRes = await fetchJson(`${SERVICES.user}/api/v1/users/me`);
    if (profileRes.ok && profileRes.data?.data?.id === testUserId) {
      pass("USER", "Token verified with user-service");
    } else {
      info("USER", `Profile check: ${JSON.stringify(profileRes.data)}`);
    }

  } catch (error) {
    fail("USER", `Failed to create test user: ${error.message}`);
  }
}

async function testVideoUpload() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  3. VIDEO UPLOAD                                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (!testToken || !testChannelId) {
    skip("VIDEO", "Skipping - no auth token or channel");
    return;
  }

  // Check sample video
  if (!fs.existsSync(SAMPLE_VIDEO_PATH)) {
    fail("VIDEO", `Sample video not found: ${SAMPLE_VIDEO_PATH}`);
    return;
  }

  const videoStats = fs.statSync(SAMPLE_VIDEO_PATH);
  info("VIDEO", `Sample video: ${(videoStats.size / 1024 / 1024).toFixed(2)} MB`);

  try {
    // Step 1: Initiate upload (video-service has no /api prefix)
    const initiateRes = await fetchJson(`${SERVICES.video}/videos/upload/initiate`, {
      method: "POST",
      body: JSON.stringify({
        fileName: "sample-video.mp4",
        fileSize: videoStats.size,
        mimeType: "video/mp4",
        title: "E2E Test Video",
        channelId: testChannelId,
      }),
    });

    if (!initiateRes.ok) {
      fail("VIDEO", `Initiate failed: ${JSON.stringify(initiateRes.data)}`);
      return;
    }

    const { uploadId, presignedUrl, videoId } = initiateRes.data;
    testVideoId = videoId;
    pass("VIDEO", `Upload initiated: uploadId=${uploadId}, videoId=${videoId}`);

    // Step 2: Upload to MinIO
    info("VIDEO", "Uploading to MinIO storage...");
    const videoBuffer = fs.readFileSync(SAMPLE_VIDEO_PATH);
    
    const uploadRes = await fetch(presignedUrl, {
      method: "PUT",
      body: videoBuffer,
      headers: { "Content-Type": "video/mp4" },
    });

    if (uploadRes.ok) {
      pass("VIDEO", "Uploaded to MinIO storage");
    } else {
      fail("VIDEO", `MinIO upload failed: ${uploadRes.status}`);
      return;
    }

    // Step 3: Complete upload (triggers transcoding)
    const completeRes = await fetchJson(`${SERVICES.video}/videos/upload/complete`, {
      method: "POST",
      body: JSON.stringify({ uploadId }),
    });

    if (completeRes.ok) {
      pass("VIDEO", "Upload completed → Transcoding event published");
    } else {
      fail("VIDEO", `Complete failed: ${JSON.stringify(completeRes.data)}`);
    }

  } catch (error) {
    fail("VIDEO", `Upload error: ${error.message}`);
  }
}

async function testTranscodingProgress() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  4. TRANSCODING                                             ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (!testVideoId) {
    skip("TRANSCODE", "Skipping - no video uploaded");
    return;
  }

  info("TRANSCODE", "Waiting 15 seconds for transcoding to start...");
  await new Promise(r => setTimeout(r, 15000));

  // Check video status (video-service has no /api prefix)
  const videoRes = await fetchJson(`${SERVICES.video}/videos/${testVideoId}`);
  
  if (videoRes.ok) {
    const video = videoRes.data?.video || videoRes.data?.data;
    const status = video?.processingStatus || video?.status;
    info("TRANSCODE", `Video status: ${status}`);
    
    if (status === "PROCESSING" || status === "COMPLETED" || status === "PUBLISHED") {
      pass("TRANSCODE", `Video is ${status}`);
    } else if (status === "PENDING") {
      info("TRANSCODE", "Still pending - transcoder may need more time");
    } else {
      info("TRANSCODE", `Status: ${status}`);
    }
    
    // Show video details if available
    if (video?.duration) info("TRANSCODE", `Duration: ${video.duration}s`);
    if (video?.hlsPlaylistUrl) pass("TRANSCODE", `HLS ready: ${video.hlsPlaylistUrl}`);
    
  } else {
    fail("TRANSCODE", `Failed to get video: ${JSON.stringify(videoRes.data)}`);
  }
}

async function testEngagement() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  5. ENGAGEMENT                                              ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (!testVideoId || !testToken) {
    skip("ENGAGE", "Skipping - no video or auth");
    return;
  }

  // Like video (engagement uses /api prefix)
  const likeRes = await fetchJson(`${SERVICES.engagement}/api/videos/${testVideoId}/like`, {
    method: "POST",
  });
  if (likeRes.ok) {
    pass("ENGAGE", "Liked video");
  } else {
    fail("ENGAGE", `Like failed: ${JSON.stringify(likeRes.data)}`);
  }

  // Add comment
  const commentRes = await fetchJson(`${SERVICES.engagement}/api/videos/${testVideoId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content: "Backend E2E test comment - great video!" }),
  });
  if (commentRes.ok) {
    const commentId = commentRes.data?.comment?.id || commentRes.data?.data?.id;
    pass("ENGAGE", `Comment added: ${commentId}`);
  } else {
    fail("ENGAGE", `Comment failed: ${JSON.stringify(commentRes.data)}`);
  }

  // Record view
  const viewRes = await fetchJson(`${SERVICES.engagement}/api/videos/${testVideoId}/view`, {
    method: "POST",
    body: JSON.stringify({ watchTime: 30, completed: false }),
  });
  if (viewRes.ok) {
    pass("ENGAGE", "View recorded");
  } else {
    info("ENGAGE", `View response: ${viewRes.status}`);
  }

  // Get video stats
  const statsRes = await fetchJson(`${SERVICES.engagement}/api/videos/${testVideoId}/stats`);
  if (statsRes.ok) {
    const stats = statsRes.data?.stats || statsRes.data;
    info("ENGAGE", `Stats: ${JSON.stringify(stats)}`);
  }
}

async function testSearchAndFeed() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  6. SEARCH & FEED                                           ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Search
  const searchRes = await fetchJson(`${SERVICES.search}/api/search?q=test&type=videos`);
  if (searchRes.ok) {
    const count = searchRes.data?.results?.length || searchRes.data?.hits?.length || 0;
    pass("SEARCH", `Search returned ${count} results`);
  } else {
    fail("SEARCH", `Search failed: ${searchRes.error || searchRes.status}`);
  }

  // Trending feed
  const trendingRes = await fetchJson(`${SERVICES.feed}/api/feed/trending`);
  if (trendingRes.ok) {
    const count = trendingRes.data?.videos?.length || trendingRes.data?.length || 0;
    pass("FEED", `Trending feed: ${count} videos`);
  } else {
    fail("FEED", `Trending failed: ${trendingRes.error || trendingRes.status}`);
  }

  // Subscription feed
  if (testToken) {
    const subRes = await fetchJson(`${SERVICES.feed}/api/feed/subscription`);
    if (subRes.ok) {
      pass("FEED", "Subscription feed accessible");
    } else {
      info("FEED", `Subscription: ${subRes.status}`);
    }
  }
}

async function testNotifications() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  7. NOTIFICATIONS                                           ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (!testToken) {
    skip("NOTIFY", "Skipping - no auth");
    return;
  }

  const notifyRes = await fetchJson(`${SERVICES.notification}/api/notifications`);
  if (notifyRes.ok) {
    const notifications = notifyRes.data?.notifications || notifyRes.data || [];
    const count = Array.isArray(notifications) ? notifications.length : 0;
    pass("NOTIFY", `Notifications: ${count} total`);
  } else {
    fail("NOTIFY", `Failed: ${notifyRes.error || JSON.stringify(notifyRes.data)}`);
  }
}

async function cleanup() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  CLEANUP                                                    ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  try {
    // Delete test video if created
    if (testVideoId) {
      await prisma.video.deleteMany({ where: { id: testVideoId } });
      info("CLEANUP", `Deleted test video: ${testVideoId}`);
    }
    
    // Delete test channel
    if (testChannelId) {
      await prisma.channel.deleteMany({ where: { id: testChannelId } });
      info("CLEANUP", `Deleted test channel: ${testChannelId}`);
    }
    
    // Delete test user
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
      info("CLEANUP", `Deleted test user: ${testUserId}`);
    }
    
    pass("CLEANUP", "Test data cleaned up");
  } catch (error) {
    info("CLEANUP", `Cleanup error: ${error.message}`);
  }
}

// ===============================
// MAIN
// ===============================

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     PLAY PLATFORM - COMPLETE BACKEND E2E TEST              ║");
  console.log("║     Testing full video upload → transcode → engage flow    ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  try {
    await testHealthChecks();
    await setupTestUser();
    await testVideoUpload();
    await testTranscodingProgress();
    await testEngagement();
    await testSearchAndFeed();
    await testNotifications();
    // await cleanup();  // Optionally clean up test data
  } finally {
    await prisma.$disconnect();
  }

  // Summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     BACKEND E2E TEST RESULTS                                ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`   ✅ Passed:  ${results.passed}`);
  console.log(`   ❌ Failed:  ${results.failed}`);
  console.log(`   ⏭️  Skipped: ${results.skipped}`);
  console.log(`   📊 Total:   ${results.passed + results.failed + results.skipped}`);
  console.log("════════════════════════════════════════════════════════════════\n");

  if (testVideoId) {
    console.log(`📹 Test video: ${testVideoId}`);
    console.log(`   Check status: curl ${SERVICES.video}/videos/${testVideoId}`);
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(console.error);
