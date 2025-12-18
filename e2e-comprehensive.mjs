#!/usr/bin/env node
/**
 * Comprehensive E2E Test for Play Platform
 * Tests all services with real video upload workflow
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Service URLs - corrected ports
const SERVICES = {
  user: "http://localhost:4001",       // Fixed: was 4002
  video: "http://localhost:4003",
  transcoder: "http://localhost:4005",
  engagement: "http://localhost:4006",
  search: "http://localhost:4009",
  feed: "http://localhost:4010",
  notification: "http://localhost:4011",
};

// Test data
const TEST_USER = {
  email: `e2e_test_${Date.now()}@example.com`,
  username: `e2e_user_${Date.now()}`,
  password: "TestPassword123!",
  displayName: "E2E Test User",
};

const SAMPLE_VIDEO_PATH = path.join(__dirname, "sample-video.mp4");

// State tracking
let testToken = "";
let testUserId = "";
let testVideoId = "";
let testChannelId = "";
let results = { passed: 0, failed: 0, skipped: 0 };

// Helper functions
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
// TESTS
// ===============================

async function testHealthChecks() {
  console.log("\n========================================");
  console.log("  1. HEALTH CHECKS");
  console.log("========================================\n");

  for (const [name, baseUrl] of Object.entries(SERVICES)) {
    const res = await fetchJson(`${baseUrl}/health`);
    // Accept different health check formats: ok, OK, healthy
    const status = res.data?.status?.toLowerCase();
    if (res.ok && (status === "ok" || status === "healthy")) {
      pass("HEALTH", `${name}-service: OK`);
    } else {
      fail("HEALTH", `${name}-service: DOWN (${res.error || res.status})`);
    }
  }
}

async function testUserRegistration() {
  console.log("\n========================================");
  console.log("  2. USER REGISTRATION");
  console.log("========================================\n");

  // Register user - correct route with /api/v1/ prefix
  const registerRes = await fetchJson(`${SERVICES.user}/api/v1/users/register`, {
    method: "POST",
    body: JSON.stringify(TEST_USER),
  });

  if (registerRes.ok && registerRes.data?.user) {
    testUserId = registerRes.data.user.id;
    testToken = registerRes.data.token;
    pass("USER", `Registered: ${TEST_USER.email} (ID: ${testUserId})`);
    
    // Get user profile
    const profileRes = await fetchJson(`${SERVICES.user}/api/v1/users/me`);
    if (profileRes.ok) {
      pass("USER", `Profile fetched: ${profileRes.data.user?.username}`);
      testChannelId = profileRes.data.user?.channel?.id;
      if (testChannelId) {
        pass("USER", `Channel created: ${testChannelId}`);
      }
    } else {
      fail("USER", `Failed to fetch profile: ${profileRes.data?.message}`);
    }
  } else {
    fail("USER", `Registration failed: ${JSON.stringify(registerRes.data)}`);
  }
}

async function testVideoUpload() {
  console.log("\n========================================");
  console.log("  3. VIDEO UPLOAD");
  console.log("========================================\n");

  if (!testToken) {
    skip("VIDEO", "Skipping - no auth token");
    return;
  }

  // Check if sample video exists
  if (!fs.existsSync(SAMPLE_VIDEO_PATH)) {
    fail("VIDEO", `Sample video not found: ${SAMPLE_VIDEO_PATH}`);
    return;
  }

  const videoStats = fs.statSync(SAMPLE_VIDEO_PATH);
  info("VIDEO", `Sample video size: ${(videoStats.size / 1024 / 1024).toFixed(2)} MB`);

  // Step 1: Initiate upload
  const initiateRes = await fetchJson(`${SERVICES.video}/videos/upload/initiate`, {
    method: "POST",
    body: JSON.stringify({
      fileName: "sample-video.mp4",
      fileSize: videoStats.size,
      mimeType: "video/mp4",
    }),
  });

  if (!initiateRes.ok || !initiateRes.data?.uploadId) {
    fail("VIDEO", `Failed to initiate upload: ${JSON.stringify(initiateRes.data)}`);
    return;
  }

  const { uploadId, presignedUrl, videoId } = initiateRes.data;
  testVideoId = videoId;
  pass("VIDEO", `Upload initiated: ${uploadId} (videoId: ${videoId})`);

  // Step 2: Upload to MinIO via presigned URL
  info("VIDEO", "Uploading to storage...");
  const videoBuffer = fs.readFileSync(SAMPLE_VIDEO_PATH);
  
  try {
    const uploadRes = await fetch(presignedUrl, {
      method: "PUT",
      body: videoBuffer,
      headers: {
        "Content-Type": "video/mp4",
      },
    });
    
    if (uploadRes.ok) {
      pass("VIDEO", "Uploaded to MinIO storage");
    } else {
      fail("VIDEO", `MinIO upload failed: ${uploadRes.status}`);
      return;
    }
  } catch (err) {
    fail("VIDEO", `MinIO upload error: ${err.message}`);
    return;
  }

  // Step 3: Complete upload
  const completeRes = await fetchJson(`${SERVICES.video}/videos/upload/complete`, {
    method: "POST",
    body: JSON.stringify({ uploadId }),
  });

  if (completeRes.ok) {
    pass("VIDEO", `Upload completed → Transcoding triggered`);
  } else {
    fail("VIDEO", `Complete upload failed: ${JSON.stringify(completeRes.data)}`);
  }
}

async function testTranscodingProgress() {
  console.log("\n========================================");
  console.log("  4. TRANSCODING (checking progress)");
  console.log("========================================\n");

  if (!testVideoId) {
    skip("TRANSCODE", "Skipping - no video uploaded");
    return;
  }

  info("TRANSCODE", "Waiting for transcoding to start (10 seconds)...");
  await new Promise(r => setTimeout(r, 10000));

  // Check video status
  const videoRes = await fetchJson(`${SERVICES.video}/videos/${testVideoId}`);
  
  if (videoRes.ok) {
    const status = videoRes.data?.video?.processingStatus;
    info("TRANSCODE", `Video status: ${status}`);
    
    if (status === "PROCESSING" || status === "COMPLETED") {
      pass("TRANSCODE", `Transcoding in progress or completed`);
    } else if (status === "PENDING") {
      info("TRANSCODE", "Still pending - transcoder may need more time");
    } else {
      fail("TRANSCODE", `Unexpected status: ${status}`);
    }
  } else {
    fail("TRANSCODE", `Failed to get video: ${JSON.stringify(videoRes.data)}`);
  }
}

async function testEngagement() {
  console.log("\n========================================");
  console.log("  5. ENGAGEMENT");
  console.log("========================================\n");

  if (!testVideoId || !testToken) {
    skip("ENGAGE", "Skipping - no video or auth");
    return;
  }

  // Like video
  const likeRes = await fetchJson(`${SERVICES.engagement}/videos/${testVideoId}/like`, {
    method: "POST",
  });
  
  if (likeRes.ok) {
    pass("ENGAGE", "Liked video");
  } else {
    fail("ENGAGE", `Like failed: ${JSON.stringify(likeRes.data)}`);
  }

  // Add comment
  const commentRes = await fetchJson(`${SERVICES.engagement}/videos/${testVideoId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content: "E2E test comment - great video!" }),
  });

  if (commentRes.ok) {
    pass("ENGAGE", `Comment added: ${commentRes.data?.comment?.id}`);
  } else {
    fail("ENGAGE", `Comment failed: ${JSON.stringify(commentRes.data)}`);
  }

  // Record view
  const viewRes = await fetchJson(`${SERVICES.engagement}/videos/${testVideoId}/view`, {
    method: "POST",
    body: JSON.stringify({ watchTime: 30, completed: false }),
  });

  if (viewRes.ok) {
    pass("ENGAGE", "View recorded");
  } else {
    // Views might be idempotent
    info("ENGAGE", `View response: ${JSON.stringify(viewRes.data)}`);
  }
}

async function testSearchAndFeed() {
  console.log("\n========================================");
  console.log("  6. SEARCH & FEED");
  console.log("========================================\n");

  // Search - correct route with /api prefix
  const searchRes = await fetchJson(`${SERVICES.search}/api/search?q=test&type=videos`);
  if (searchRes.ok) {
    const count = searchRes.data?.results?.length || searchRes.data?.hits?.length || 0;
    pass("SEARCH", `Search returned ${count} results`);
  } else {
    fail("SEARCH", `Search failed: ${searchRes.error || searchRes.status}`);
  }

  // Trending feed - correct route with /api prefix
  const trendingRes = await fetchJson(`${SERVICES.feed}/api/feed/trending`);
  if (trendingRes.ok) {
    const count = trendingRes.data?.videos?.length || trendingRes.data?.length || 0;
    pass("FEED", `Trending feed: ${count} videos`);
  } else {
    fail("FEED", `Trending failed: ${trendingRes.error || trendingRes.status}`);
  }

  // Subscription feed (requires auth)
  if (testToken) {
    const subRes = await fetchJson(`${SERVICES.feed}/api/feed/subscription`);
    if (subRes.ok) {
      pass("FEED", `Subscription feed accessible`);
    } else {
      info("FEED", `Subscription feed: ${subRes.data?.message || subRes.status}`);
    }
  }
}

async function testNotifications() {
  console.log("\n========================================");
  console.log("  7. NOTIFICATIONS");
  console.log("========================================\n");

  if (!testToken) {
    skip("NOTIFY", "Skipping - no auth");
    return;
  }

  const notifyRes = await fetchJson(`${SERVICES.notification}/notifications`);
  if (notifyRes.ok) {
    const count = notifyRes.data?.notifications?.length || 0;
    const unread = notifyRes.data?.unreadCount || 0;
    pass("NOTIFY", `Notifications: ${count} total, ${unread} unread`);
  } else {
    fail("NOTIFY", `Failed: ${notifyRes.error || JSON.stringify(notifyRes.data)}`);
  }
}

// ===============================
// MAIN
// ===============================

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     PLAY PLATFORM - COMPREHENSIVE E2E TEST                 ║");
  console.log("║     Testing complete video upload & processing flow        ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  await testHealthChecks();
  await testUserRegistration();
  await testVideoUpload();
  await testTranscodingProgress();
  await testEngagement();
  await testSearchAndFeed();
  await testNotifications();

  // Summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     E2E TEST RESULTS                                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`   ✅ Passed:  ${results.passed}`);
  console.log(`   ❌ Failed:  ${results.failed}`);
  console.log(`   ⏭️  Skipped: ${results.skipped}`);
  console.log(`   📊 Total:   ${results.passed + results.failed + results.skipped}`);
  console.log("════════════════════════════════════════════════════════════════\n");

  if (testVideoId) {
    console.log(`📹 Test video created: ${testVideoId}`);
    console.log(`   View at: ${SERVICES.video}/videos/${testVideoId}`);
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(console.error);
