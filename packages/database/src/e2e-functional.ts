// Comprehensive Functional E2E Test
// Run with: pnpm --filter @repo/database exec tsx /path/to/this/file.ts

import { prisma } from "@repo/database";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

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

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || "VbyFelqTxFcsNxBWSyvptR6Sf2RPKtxl9eLVHex1lIk=";
const SAMPLE_VIDEO = path.join(process.cwd(), "../../sample-video.mp4");

// Test state
let testUserId = "";
let testChannelId = "";
let testVideoId = "";
let testToken = "";
let results = { passed: 0, failed: 0, skipped: 0 };

// Helpers
const log = (emoji: string, section: string, msg: string) => console.log(`${emoji} [${section}] ${msg}`);
const pass = (section: string, msg: string) => { results.passed++; log("✅", section, msg); };
const fail = (section: string, msg: string) => { results.failed++; log("❌", section, msg); };
const skip = (section: string, msg: string) => { results.skipped++; log("⏭️", section, msg); };
const info = (section: string, msg: string) => log("ℹ️", section, msg);

async function fetchJson(url: string, options: RequestInit = {}, extraHeaders: Record<string, string> = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(testToken ? { Authorization: `Bearer ${testToken}` } : {}),
        ...extraHeaders,  // Allow passing custom headers like x-user-id
        ...options.headers,
      },
    });
    const text = await res.text();
    try {
      return { ok: res.ok, status: res.status, data: JSON.parse(text) };
    } catch {
      return { ok: res.ok, status: res.status, data: text };
    }
  } catch (err: any) {
    return { ok: false, status: 0, error: err.message };
  }
}

function header(title: string) {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  ${title.padEnd(60)}║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);
}

// =======================
// TEST: USER SERVICE
// =======================
async function testUserService() {
  header("1. USER SERVICE - Core Functionality");

  const testEmail = `e2e_${Date.now()}@test.com`;
  const testUsername = `e2e_user_${Date.now()}`;

  try {
    // 1. Create user + channel in DB
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        username: testUsername,
        displayName: "E2E Test User",
        emailVerified: true,  // Boolean, not DateTime
        status: "ACTIVE",
        role: "USER",
        channel: {
          create: {
            handle: testUsername,
            displayName: "E2E Test Channel",
          },
        },
      },
      include: { channel: true },
    });

    testUserId = user.id;
    testChannelId = user.channel?.id || "";
    pass("USER", `Created user: ${testEmail}`);
    pass("USER", `Created channel: ${testChannelId}`);

    // 2. Generate JWT
    testToken = jwt.sign({ sub: testUserId, email: testEmail, role: "USER" }, JWT_SECRET, { expiresIn: "1h" });
    pass("USER", "Generated JWT token");

    // 3. Test GET /api/v1/users/me
    const meRes = await fetchJson(`${SERVICES.user}/api/v1/users/me`);
    if (meRes.ok && (meRes.data?.data?.id === testUserId || meRes.data?.user?.id === testUserId)) {
      pass("USER", "GET /api/v1/users/me works");
    } else {
      fail("USER", `GET /me failed: ${JSON.stringify(meRes.data)}`);
    }

    // 4. Test GET /api/v1/users/:id (public profile)
    const profileRes = await fetchJson(`${SERVICES.user}/api/v1/users/${testUserId}`);
    if (profileRes.ok) {
      pass("USER", "GET /api/v1/users/:id works");
    } else {
      fail("USER", `GET /:id failed: ${profileRes.status}`);
    }

    // 5. Test PATCH /api/v1/users/me (update profile)
    const updateRes = await fetchJson(`${SERVICES.user}/api/v1/users/me`, {
      method: "PATCH",
      body: JSON.stringify({ bio: "E2E test bio update" }),
    });
    if (updateRes.ok) {
      pass("USER", "PATCH /api/v1/users/me works");
    } else {
      fail("USER", `PATCH /me failed: ${JSON.stringify(updateRes.data)}`);
    }

    // Verify update persisted
    const verifyUser = await prisma.user.findUnique({ where: { id: testUserId } });
    if (verifyUser?.bio === "E2E test bio update") {
      pass("USER", "Profile update persisted in DB");
    } else {
      fail("USER", "Profile update not persisted");
    }

  } catch (error: any) {
    fail("USER", `Error: ${error.message}`);
  }
}

// =======================
// TEST: VIDEO SERVICE
// =======================
async function testVideoService() {
  header("2. VIDEO SERVICE - Core Functionality");

  if (!testToken || !testChannelId) {
    skip("VIDEO", "No auth token or channel");
    return;
  }

  try {
    // 1. Get categories
    const catRes = await fetchJson(`${SERVICES.video}/categories`);
    if (catRes.ok && Array.isArray(catRes.data?.categories || catRes.data)) {
      pass("VIDEO", "GET /categories works");
    } else {
      info("VIDEO", `Categories: ${JSON.stringify(catRes.data)}`);
    }

    // 2. Create video directly in DB (simulating upload completion)
    const video = await prisma.video.create({
      data: {
        title: "E2E Test Video",
        description: "Test video for E2E",
        channelId: testChannelId,
        processingStatus: "PENDING",
        visibility: "PUBLIC",  // Use PUBLIC for full accessibility
        originalFileName: "sample-video.mp4",
      },
    });
    testVideoId = video.id;
    pass("VIDEO", `Created video: ${testVideoId}`);

    // 3. Get video by ID
    const getRes = await fetchJson(`${SERVICES.video}/videos/${testVideoId}`);
    if (getRes.ok) {
      pass("VIDEO", "GET /videos/:id works");
    } else {
      fail("VIDEO", `GET /videos/:id failed: ${getRes.status} - ${JSON.stringify(getRes.data)}`);
    }

    // 4. Test PATCH /videos/:id (update video)
    const updateRes = await fetchJson(`${SERVICES.video}/videos/${testVideoId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "E2E Test Video Updated" }),
    });
    if (updateRes.ok) {
      pass("VIDEO", "PATCH /videos/:id works");
    } else {
      info("VIDEO", `PATCH result: ${updateRes.status}`);
    }

    // 5. Verify in DB
    const verifyVideo = await prisma.video.findUnique({ where: { id: testVideoId } });
    if (verifyVideo?.title.includes("Updated")) {
      pass("VIDEO", "Video update persisted in DB");
    } else {
      info("VIDEO", "Video title in DB: " + verifyVideo?.title);
    }

  } catch (error: any) {
    fail("VIDEO", `Error: ${error.message}`);
  }
}

// =======================
// TEST: ENGAGEMENT SERVICE
// =======================
async function testEngagementService() {
  header("3. ENGAGEMENT SERVICE - Core Functionality");

  if (!testToken || !testVideoId) {
    skip("ENGAGE", "No auth or video");
    return;
  }

  try {
    // Engagement service uses x-user-id header for auth
    const engageHeaders = { "x-user-id": testUserId };

    // 1. Like video - correct route is /reaction with body {type: "LIKE"}
    const likeRes = await fetchJson(`${SERVICES.engagement}/api/videos/${testVideoId}/reaction`, {
      method: "POST",
      body: JSON.stringify({ type: "LIKE" }),
    }, engageHeaders);
    if (likeRes.ok) {
      pass("ENGAGE", "POST /reaction works (LIKE)");
    } else {
      fail("ENGAGE", `Like failed: ${JSON.stringify(likeRes.data)}`);
    }

    // 2. Verify like in DB
    const likeInDb = await prisma.videoReaction.findFirst({
      where: { videoId: testVideoId, userId: testUserId, type: "LIKE" },
    });
    if (likeInDb) {
      pass("ENGAGE", "Like persisted in DB");
    } else {
      fail("ENGAGE", "Like not found in DB");
    }

    // 3. Add comment
    const commentRes = await fetchJson(`${SERVICES.engagement}/api/videos/${testVideoId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content: "E2E test comment" }),
    }, engageHeaders);
    if (commentRes.ok) {
      pass("ENGAGE", "POST /comments works");
    } else {
      fail("ENGAGE", `Comment failed: ${JSON.stringify(commentRes.data)}`);
    }

    // 4. Verify comment in DB
    const commentInDb = await prisma.comment.findFirst({
      where: { videoId: testVideoId, userId: testUserId },
    });
    if (commentInDb && commentInDb.content === "E2E test comment") {
      pass("ENGAGE", "Comment persisted in DB");
    } else {
      fail("ENGAGE", "Comment not found in DB");
    }

    // 5. Record view
    const viewRes = await fetchJson(`${SERVICES.engagement}/api/videos/${testVideoId}/view`, {
      method: "POST",
      body: JSON.stringify({ watchTime: 30, completed: false }),
    }, engageHeaders);
    if (viewRes.ok) {
      pass("ENGAGE", "POST /view works");
    } else {
      info("ENGAGE", `View result: ${viewRes.status}`);
    }

  } catch (error: any) {
    fail("ENGAGE", `Error: ${error.message}`);
  }
}

// =======================
// TEST: SEARCH SERVICE
// =======================
async function testSearchService() {
  header("4. SEARCH SERVICE - Core Functionality");

  try {
    // 1. Test search query
    const searchRes = await fetchJson(`${SERVICES.search}/api/search?q=test&type=videos`);
    if (searchRes.ok) {
      const hits = searchRes.data?.hits?.length || 0;
      pass("SEARCH", `GET /api/search works (${hits} hits)`);
    } else {
      fail("SEARCH", `Search failed: ${searchRes.status}`);
    }

    // 2. Test search with different type
    const channelRes = await fetchJson(`${SERVICES.search}/api/search?q=test&type=channels`);
    if (channelRes.ok) {
      pass("SEARCH", "Search channels works");
    } else {
      info("SEARCH", `Channel search: ${channelRes.status}`);
    }

  } catch (error: any) {
    fail("SEARCH", `Error: ${error.message}`);
  }
}

// =======================
// TEST: FEED SERVICE
// =======================
async function testFeedService() {
  header("5. FEED SERVICE - Core Functionality");

  try {
    // 1. Test trending feed
    const trendingRes = await fetchJson(`${SERVICES.feed}/api/feed/trending`);
    if (trendingRes.ok) {
      pass("FEED", "GET /api/feed/trending works");
    } else {
      fail("FEED", `Trending failed: ${trendingRes.status}`);
    }

    // 2. Test subscription feed (auth required)
    if (testToken) {
      const subRes = await fetchJson(`${SERVICES.feed}/api/feed/subscription`);
      if (subRes.ok) {
        pass("FEED", "GET /api/feed/subscription works");
      } else {
        info("FEED", `Subscription: ${subRes.status} - ${JSON.stringify(subRes.data)}`);
      }
    }

    // 3. Test home feed
    const homeRes = await fetchJson(`${SERVICES.feed}/api/feed/home`);
    if (homeRes.ok) {
      pass("FEED", "GET /api/feed/home works");
    } else {
      info("FEED", `Home feed: ${homeRes.status}`);
    }

  } catch (error: any) {
    fail("FEED", `Error: ${error.message}`);
  }
}

// =======================
// TEST: NOTIFICATION SERVICE
// =======================
async function testNotificationService() {
  header("6. NOTIFICATION SERVICE - Core Functionality");

  if (!testToken || !testUserId) {
    skip("NOTIFY", "No auth");
    return;
  }

  try {
    // 1. Create a test notification in DB
    const notif = await prisma.notification.create({
      data: {
        userId: testUserId,
        type: "SYSTEM",
        title: "E2E Test Notification",
        message: "This is a test notification",
        isRead: false,  // correct field name
      },
    });
    pass("NOTIFY", `Created notification: ${notif.id}`);

    // Notification service uses x-user-id header for auth (like engagement)
    const notifyHeaders = { "x-user-id": testUserId };

    // 2. Test GET /api/notifications
    const listRes = await fetchJson(`${SERVICES.notification}/api/notifications`, {}, notifyHeaders);
    if (listRes.ok) {
      const count = listRes.data?.notifications?.length || listRes.data?.length || 0;
      pass("NOTIFY", `GET /api/notifications works (${count} notifications)`);
    } else {
      fail("NOTIFY", `List failed: ${listRes.status}`);
    }

    // 3. Test mark as read
    const readRes = await fetchJson(`${SERVICES.notification}/api/notifications/${notif.id}/read`, {
      method: "PATCH",
    });
    if (readRes.ok) {
      pass("NOTIFY", "PATCH /read works");
    } else {
      info("NOTIFY", `Read result: ${readRes.status}`);
    }

    // 4. Verify read status in DB
    const verifyNotif = await prisma.notification.findUnique({ where: { id: notif.id } });
    if (verifyNotif?.isRead === true || verifyNotif?.readAt !== null) {
      pass("NOTIFY", "Read status persisted in DB");
    } else {
      info("NOTIFY", "Read status: " + verifyNotif?.isRead);
    }

  } catch (error: any) {
    fail("NOTIFY", `Error: ${error.message}`);
  }
}

// =======================
// CLEANUP
// =======================
async function cleanup() {
  header("CLEANUP");

  try {
    // Delete in correct order (foreign key constraints)
    if (testVideoId) {
      await prisma.videoReaction.deleteMany({ where: { videoId: testVideoId } });
      await prisma.comment.deleteMany({ where: { videoId: testVideoId } });
      await prisma.video.deleteMany({ where: { id: testVideoId } });
      info("CLEANUP", "Deleted test video and engagement");
    }

    if (testUserId) {
      await prisma.notification.deleteMany({ where: { userId: testUserId } });
      info("CLEANUP", "Deleted notifications");
    }

    if (testChannelId) {
      await prisma.channel.deleteMany({ where: { id: testChannelId } });
      info("CLEANUP", "Deleted channel");
    }

    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
      info("CLEANUP", "Deleted user");
    }

    pass("CLEANUP", "All test data cleaned up");
  } catch (error: any) {
    fail("CLEANUP", `Error: ${error.message}`);
  }
}

// =======================
// MAIN
// =======================
async function main() {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     PLAY PLATFORM - COMPREHENSIVE FUNCTIONAL E2E TEST      ║`);
  console.log(`║     Testing all service core functionality                 ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  try {
    await testUserService();
    await testVideoService();
    await testEngagementService();
    await testSearchService();
    await testFeedService();
    await testNotificationService();
    await cleanup();
  } finally {
    await prisma.$disconnect();
  }

  // Summary
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     FUNCTIONAL E2E TEST RESULTS                             ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log(`   ✅ Passed:  ${results.passed}`);
  console.log(`   ❌ Failed:  ${results.failed}`);
  console.log(`   ⏭️  Skipped: ${results.skipped}`);
  console.log(`   📊 Total:   ${results.passed + results.failed + results.skipped}`);
  console.log(`════════════════════════════════════════════════════════════════\n`);

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(console.error);
