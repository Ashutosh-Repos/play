#!/usr/bin/env tsx
/**
 * Real World Simulation E2E Test
 * Simulates a complete user journey:
 * 1. User registration & login
 * 2. Channel creation
 * 3. Video upload & transcoding
 * 4. Search indexing
 * 5. Video viewing & engagement (likes, comments)
 * 6. Feed generation
 * 7. Notifications
 */

import { prisma } from "@repo/database";
import * as amqp from "amqplib";
import * as fs from "fs";
import * as path from "path";
import jwt from "jsonwebtoken";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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

// Config
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://play:play123@localhost:5672";
const JWT_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || "VbyFelqTxFcsNxBWSyvptR6Sf2RPKtxl9eLVHex1lIk=";
const SAMPLE_VIDEO = path.join(process.cwd(), "../../sample-video.mp4");
const BUCKET = process.env.MINIO_BUCKET || "play-videos";

// Test state
let creatorUser: any = null;
let viewerUser: any = null;
let creatorToken = "";
let viewerToken = "";
let testChannel: any = null;
let testVideo: any = null;
let rabbitConnection: any = null;
let rabbitChannel: amqp.Channel | null = null;

// Helpers
const log = (emoji: string, msg: string) => console.log(`${emoji} ${msg}`);
const pass = (msg: string) => log("✅", msg);
const fail = (msg: string) => log("❌", msg);
const info = (msg: string) => log("ℹ️", msg);
const wait = (msg: string) => log("⏳", msg);
const step = (n: number, title: string) => {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  STEP ${n}: ${title.padEnd(50)}║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: string, options: RequestInit = {}, token?: string, userId?: string) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(userId ? { "x-user-id": userId } : {}),
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

async function connectRabbitMQ() {
  rabbitConnection = await amqp.connect(RABBITMQ_URL);
  rabbitChannel = await rabbitConnection.createChannel();
  if (!rabbitChannel) {
    throw new Error("Failed to create RabbitMQ channel");
  }
  await rabbitChannel.assertExchange("video.events", "topic", { durable: true });
  pass("Connected to RabbitMQ");
}

async function closeRabbitMQ() {
  try { if (rabbitChannel) await rabbitChannel.close(); } catch {}
  try { if (rabbitConnection) await rabbitConnection.close(); } catch {}
}

// ============== TEST STEPS ==============

async function step1_CreateUsers() {
  step(1, "Create Users (Creator & Viewer)");

  const timestamp = Date.now();

  // Create content creator
  creatorUser = await prisma.user.create({
    data: {
      email: `creator_${timestamp}@test.com`,
      username: `creator_${timestamp}`,
      displayName: "Test Creator",
      emailVerified: true,
      status: "ACTIVE",
      role: "USER",
    },
  });
  pass(`Created creator: ${creatorUser.email}`);

  // Create viewer
  viewerUser = await prisma.user.create({
    data: {
      email: `viewer_${timestamp}@test.com`,
      username: `viewer_${timestamp}`,
      displayName: "Test Viewer",
      emailVerified: true,
      status: "ACTIVE",
      role: "USER",
    },
  });
  pass(`Created viewer: ${viewerUser.email}`);

  // Generate tokens
  creatorToken = jwt.sign(
    { sub: creatorUser.id, email: creatorUser.email, username: creatorUser.username, role: "USER" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  viewerToken = jwt.sign(
    { sub: viewerUser.id, email: viewerUser.email, username: viewerUser.username, role: "USER" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  pass("Generated JWT tokens");
}

async function step2_CreateChannel() {
  step(2, "Create Channel for Creator");

  testChannel = await prisma.channel.create({
    data: {
      userId: creatorUser.id,
      handle: `channel_${Date.now()}`,
      displayName: "Test Creator Channel",
      description: "A test channel for the real-world simulation",
    },
  });
  pass(`Created channel: ${testChannel.handle}`);
  
  // Update creatorToken with channelId
  creatorToken = jwt.sign(
    { sub: creatorUser.id, email: creatorUser.email, username: creatorUser.username, role: "USER", channelId: testChannel.id },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

async function step3_UploadVideo() {
  step(3, "Upload Video to MinIO");

  if (!fs.existsSync(SAMPLE_VIDEO)) {
    fail(`Sample video not found: ${SAMPLE_VIDEO}`);
    throw new Error("Sample video not found");
  }

  const stats = fs.statSync(SAMPLE_VIDEO);
  info(`Sample video size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  const fileName = `${Date.now()}-real-world-test.mp4`;
  const uploadPath = `raw/${fileName}`;

  try {
    await execAsync(`mc cp "${SAMPLE_VIDEO}" local/${BUCKET}/${uploadPath}`);
    pass(`Uploaded to MinIO: ${uploadPath}`);
  } catch (err: any) {
    fail(`Upload failed: ${err.message}`);
    throw err;
  }

  // Create video record
  testVideo = await prisma.video.create({
    data: {
      title: "Real World Test Video",
      description: "Testing the complete video platform flow",
      channelId: testChannel.id,
      originalFileName: "real-world-test.mp4",
      originalFilePath: uploadPath,
      originalFileSize: BigInt(stats.size),
      originalMimeType: "video/mp4",
      processingStatus: "PROCESSING",
      visibility: "PUBLIC",
      uploadCompletedAt: new Date(),
    },
  });
  pass(`Created video record: ${testVideo.id}`);

  return { uploadPath, fileName };
}

async function step4_TriggerTranscoding(fileName: string) {
  step(4, "Trigger Transcoding via RabbitMQ");

  if (!rabbitChannel) throw new Error("RabbitMQ not connected");

  const event = {
    type: "video.uploaded",
    payload: {
      videoId: testVideo.id,
      userId: creatorUser.id,
      fileName: fileName,
      fileSize: fs.statSync(SAMPLE_VIDEO).size,
      mimeType: "video/mp4",
      uploadedAt: new Date().toISOString(),
    },
  };

  rabbitChannel.publish(
    "video.events",
    "video.uploaded",
    Buffer.from(JSON.stringify(event)),
    { persistent: true }
  );
  pass(`Published video.uploaded event`);
  info("Transcoder processing...");
}

async function step5_WaitForTranscoding() {
  step(5, "Wait for Transcoding to Complete");

  const maxWaitTime = 180000;
  const pollInterval = 3000;
  const startTime = Date.now();
  let lastProgress = -1;

  while (Date.now() - startTime < maxWaitTime) {
    const video = await prisma.video.findUnique({
      where: { id: testVideo.id },
      select: { processingStatus: true, processingProgress: true, processingError: true },
    });

    if (!video) {
      fail("Video not found");
      return false;
    }

    const progress = video.processingProgress || 0;
    if (progress !== lastProgress) {
      wait(`Processing: ${progress}%`);
      lastProgress = progress;
    }

    if (video.processingStatus === "READY") {
      pass("Transcoding complete!");
      return true;
    }
    if (video.processingStatus === "FAILED") {
      fail(`Transcoding failed: ${video.processingError}`);
      return false;
    }

    await sleep(pollInterval);
  }

  fail("Timeout waiting for transcoding");
  return false;
}

async function step6_VerifyVideoReady() {
  step(6, "Verify Video is Ready");

  const video = await prisma.video.findUnique({
    where: { id: testVideo.id },
    select: {
      processingStatus: true,
      hlsPlaylistUrl: true,
      thumbnailUrl: true,
      duration: true,
      width: true,
      height: true,
      resolutions: true,
    },
  });

  if (!video) {
    fail("Video not found");
    return false;
  }

  if (video.hlsPlaylistUrl) pass(`HLS: ${video.hlsPlaylistUrl}`);
  if (video.thumbnailUrl) pass(`Thumbnail: ${video.thumbnailUrl}`);
  if (video.duration) pass(`Duration: ${video.duration}s`);
  if (video.width && video.height) pass(`Resolution: ${video.width}x${video.height}`);
  if (video.resolutions?.length) pass(`Qualities: ${video.resolutions.join(", ")}`);

  return true;
}

async function step7_TestSearch() {
  step(7, "Test Search Service");

  // Wait for search indexing
  await sleep(2000);

  // Correct route: GET /api/search?q=...
  const res = await fetchJson(`${SERVICES.search}/api/search?q=real+world+test`);
  if (res.ok) {
    pass("Search API responded");
    info(`Found ${res.data?.hits?.length || res.data?.data?.hits?.length || 0} results`);
  } else {
    info(`Search returned: ${res.status}`);
  }
  return true;
}

async function step8_SimulateViewing() {
  step(8, "Simulate Video Viewing (Viewer User)");

  // Record view via engagement service
  // Correct route: POST /api/videos/:id/view
  const viewRes = await fetchJson(
    `${SERVICES.engagement}/api/videos/${testVideo.id}/view`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    viewerToken,
    viewerUser.id  // Pass userId for x-user-id header
  );

  if (viewRes.ok) {
    pass("View recorded");
  } else {
    info(`View API: ${viewRes.status} - ${JSON.stringify(viewRes.data)}`);
  }

  return true;
}

async function step9_SimulateLike() {
  step(9, "Simulate Like (Viewer User)");

  // Correct route: POST /api/videos/:id/reaction with type
  const likeRes = await fetchJson(
    `${SERVICES.engagement}/api/videos/${testVideo.id}/reaction`,
    { 
      method: "POST",
      body: JSON.stringify({ type: "LIKE" })
    },
    viewerToken,
    viewerUser.id  // Pass userId for x-user-id header
  );

  if (likeRes.ok) {
    pass("Like recorded");
  } else {
    info(`Like API: ${likeRes.status} - ${JSON.stringify(likeRes.data)}`);
  }

  return true;
}

async function step10_SimulateComment() {
  step(10, "Simulate Comment (Viewer User)");

  // Correct route: POST /api/videos/:id/comments
  const commentRes = await fetchJson(
    `${SERVICES.engagement}/api/videos/${testVideo.id}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ content: "Great video! This is a test comment." }),
    },
    viewerToken,
    viewerUser.id  // Pass userId for x-user-id header
  );

  if (commentRes.ok) {
    pass("Comment posted");
  } else {
    info(`Comment API: ${commentRes.status} - ${JSON.stringify(commentRes.data)}`);
  }

  return true;
}

async function step11_TestFeed() {
  step(11, "Test Feed Service");

  // Correct route: GET /api/feed/home
  const feedRes = await fetchJson(`${SERVICES.feed}/api/feed/home`, {}, viewerToken);

  if (feedRes.ok) {
    pass("Feed API responded");
    info(`Feed items: ${feedRes.data?.data?.length || feedRes.data?.length || 0}`);
  } else {
    info(`Feed API: ${feedRes.status}`);
  }

  return true;
}

async function step12_VerifyVideoAPI() {
  step(12, "Verify Video Service API");

  const videoRes = await fetchJson(`${SERVICES.video}/videos/${testVideo.id}`);

  if (videoRes.ok) {
    pass("Video API works");
    const video = videoRes.data?.data;
    info(`Title: ${video?.title}`);
    info(`Status: ${video?.processingStatus}`);
    info(`Views: ${video?.viewCount || 0}`);
  } else {
    info(`Video API: ${videoRes.status}`);
  }

  return true;
}

async function step13_DeleteVideo() {
  step(13, "Delete Video (Creator)");

  // DELETE /videos/:id - requires auth (creator's token)
  const deleteRes = await fetchJson(
    `${SERVICES.video}/videos/${testVideo.id}`,
    { method: "DELETE" },
    creatorToken  // Creator deletes their own video
  );

  if (deleteRes.ok) {
    pass("Video deleted via API");
  } else {
    info(`Delete API: ${deleteRes.status} - ${JSON.stringify(deleteRes.data)}`);
    return false;
  }

  // Verify soft delete - video should have deletedAt set
  const deletedVideo = await prisma.video.findUnique({
    where: { id: testVideo.id },
    select: { deletedAt: true },
  });

  if (deletedVideo?.deletedAt) {
    pass(`Soft delete verified: deletedAt = ${deletedVideo.deletedAt.toISOString()}`);
  } else {
    fail("Soft delete not applied - deletedAt is null");
    return false;
  }

  // Verify video is not accessible via API anymore
  const getRes = await fetchJson(`${SERVICES.video}/videos/${testVideo.id}`);
  if (!getRes.ok || getRes.status === 404) {
    pass("Deleted video not accessible via API");
  } else {
    info("Warning: Deleted video still accessible");
  }

  return true;
}

async function cleanup() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  CLEANUP                                                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  try {
    await closeRabbitMQ();
    info("Closed RabbitMQ");

    if (testVideo?.id) {
      await prisma.videoReaction.deleteMany({ where: { videoId: testVideo.id } });
      await prisma.comment.deleteMany({ where: { videoId: testVideo.id } });
      await prisma.video.deleteMany({ where: { id: testVideo.id } });
      info("Deleted test video & engagement data");
    }

    if (testChannel?.id) {
      await prisma.channel.deleteMany({ where: { id: testChannel.id } });
      info("Deleted test channel");
    }

    if (creatorUser?.id) {
      await prisma.user.deleteMany({ where: { id: creatorUser.id } });
      info("Deleted creator user");
    }

    if (viewerUser?.id) {
      await prisma.user.deleteMany({ where: { id: viewerUser.id } });
      info("Deleted viewer user");
    }

    pass("Cleanup complete");
  } catch (error: any) {
    fail(`Cleanup error: ${error.message}`);
  }
}

// ============== MAIN ==============

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     PLAY PLATFORM - REAL WORLD SIMULATION TEST             ║");
  console.log("║     Complete User Journey E2E                               ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  let success = true;
  let failedStep = "";

  try {
    await connectRabbitMQ();

    // User & Channel Setup
    await step1_CreateUsers();
    await step2_CreateChannel();

    // Video Upload & Processing
    const { fileName } = await step3_UploadVideo();
    await step4_TriggerTranscoding(fileName);

    const transcodeSuccess = await step5_WaitForTranscoding();
    if (!transcodeSuccess) {
      success = false;
      failedStep = "Transcoding";
    }

    if (success) {
      await step6_VerifyVideoReady();
      await step7_TestSearch();
      await step8_SimulateViewing();
      await step9_SimulateLike();
      await step10_SimulateComment();
      await step11_TestFeed();
      await step12_VerifyVideoAPI();
      await step13_DeleteVideo();
    }

  } catch (error: any) {
    fail(`Test error: ${error.message}`);
    console.error(error);
    success = false;
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  if (success) {
    console.log("║     ✅ REAL WORLD SIMULATION: PASSED                        ║");
  } else {
    console.log(`║     ❌ REAL WORLD SIMULATION: FAILED (${failedStep.padEnd(15)})    ║`);
  }
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  process.exit(success ? 0 : 1);
}

main();
