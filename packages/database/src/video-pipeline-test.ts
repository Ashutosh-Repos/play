#!/usr/bin/env tsx
/**
 * Video Pipeline E2E Test v2
 * Tests: Upload → Transcode → Verify HLS output
 * Uses RabbitMQ to trigger transcoding like production
 */

import { prisma } from "@repo/database";
import * as amqp from "amqplib";
import * as fs from "fs";
import * as path from "path";
import jwt from "jsonwebtoken";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Configuration
const SERVICES = {
  video: "http://localhost:4003",
  transcoder: "http://localhost:4005",
};

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://play:play123@localhost:5672";
const JWT_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || "VbyFelqTxFcsNxBWSyvptR6Sf2RPKtxl9eLVHex1lIk=";
const SAMPLE_VIDEO = path.join(process.cwd(), "../../sample-video.mp4");

// MinIO settings (must match .env and docker-compose)
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "localhost";
const MINIO_PORT = process.env.MINIO_PORT || "9000";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "playadmin";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "playadmin123";
const BUCKET = process.env.MINIO_BUCKET || "play-videos";

// Test state
let testUserId = "";
let testChannelId = "";
let testVideoId = "";
let testToken = "";
let uploadPath = "";
let rabbitConnection: amqp.Connection | null = null;
let rabbitChannel: amqp.Channel | null = null;

// Helpers
const log = (emoji: string, msg: string) => console.log(`${emoji} ${msg}`);
const pass = (msg: string) => log("✅", msg);
const fail = (msg: string) => log("❌", msg);
const info = (msg: string) => log("ℹ️", msg);
const wait = (msg: string) => log("⏳", msg);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: string, options: RequestInit = {}) {
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
  } catch (err: any) {
    return { ok: false, status: 0, error: err.message };
  }
}

async function connectRabbitMQ() {
  rabbitConnection = await amqp.connect(RABBITMQ_URL);
  rabbitChannel = await rabbitConnection.createChannel();
  await rabbitChannel.assertExchange("video.events", "topic", { durable: true });
  pass("Connected to RabbitMQ");
}

async function closeRabbitMQ() {
  if (rabbitChannel) await rabbitChannel.close().catch(() => {});
  if (rabbitConnection) await rabbitConnection.close().catch(() => {});
}

// ============== PIPELINE TEST ==============

async function setupTestData() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  STEP 1: Setup Test Data                                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const testEmail = `pipeline_${Date.now()}@test.com`;
  const testUsername = `pipeline_${Date.now()}`;

  const user = await prisma.user.create({
    data: {
      email: testEmail,
      username: testUsername,
      displayName: "Pipeline Test User",
      emailVerified: true,
      status: "ACTIVE",
      role: "USER",
      channel: {
        create: {
          handle: testUsername,
          displayName: "Pipeline Test Channel",
        },
      },
    },
    include: { channel: true },
  });

  testUserId = user.id;
  testChannelId = user.channel?.id || "";
  pass(`Created user: ${testEmail}`);
  pass(`Created channel: ${testChannelId}`);

  testToken = jwt.sign(
    { sub: testUserId, email: testEmail, username: testUsername, role: "USER", channelId: testChannelId },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  pass("Generated JWT token");
}

async function uploadVideoToMinio() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  STEP 2: Upload Video to MinIO                               ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (!fs.existsSync(SAMPLE_VIDEO)) {
    fail(`Sample video not found: ${SAMPLE_VIDEO}`);
    throw new Error("Sample video not found");
  }

  const stats = fs.statSync(SAMPLE_VIDEO);
  info(`Sample video size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  // Transcoder expects files in raw/{fileName}
  // Generate a unique filename
  const fileName = `${Date.now()}-sample-video.mp4`;
  uploadPath = `raw/${fileName}`;  // This is where transcoder downloads from
  
  try {
    // Use mc (MinIO client) - must have alias 'local' configured
    await execAsync(`mc cp "${SAMPLE_VIDEO}" local/${BUCKET}/${uploadPath}`);
    pass(`Uploaded to MinIO: ${uploadPath}`);
  } catch (err: any) {
    fail(`Upload failed: ${err.message}`);
    info("Run: mc alias set local http://localhost:9000 playadmin playadmin123");
    throw err;
  }

  return { uploadPath, fileName };
}

async function createVideoRecord(originalFilePath: string) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  STEP 3: Create Video Record                                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const video = await prisma.video.create({
    data: {
      title: "Pipeline Test Video",
      description: "Testing the full video processing pipeline",
      channelId: testChannelId,
      originalFileName: "sample-video.mp4",
      originalFilePath: originalFilePath,
      originalFileSize: BigInt(fs.statSync(SAMPLE_VIDEO).size),
      originalMimeType: "video/mp4",
      processingStatus: "PROCESSING",  // Set to PROCESSING
      visibility: "PUBLIC",
      uploadCompletedAt: new Date(),
    },
  });

  testVideoId = video.id;
  pass(`Created video record: ${testVideoId}`);
  pass(`Processing status: ${video.processingStatus}`);

  return video;
}

async function triggerTranscoding(fileName: string) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  STEP 4: Trigger Transcoding via RabbitMQ                    ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (!rabbitChannel) {
    throw new Error("RabbitMQ not connected");
  }

  // Publish video.uploaded event - same as video-service emitVideoUploaded
  // fileName must match the file in raw/ directory
  const event = {
    type: "video.uploaded",
    payload: {
      videoId: testVideoId,
      userId: testUserId,
      fileName: fileName,  // This must match the file in raw/
      fileSize: fs.statSync(SAMPLE_VIDEO).size,
      mimeType: "video/mp4",
      uploadedAt: new Date().toISOString(),
    },
  };

  rabbitChannel.publish(
    "video.events",             // Exchange (matches queues.ts EXCHANGES.VIDEO)
    "video.uploaded",           // Routing key
    Buffer.from(JSON.stringify(event)),
    { persistent: true }
  );

  pass(`Published video.uploaded event (fileName: ${fileName})`);
  info("Transcoder should pick up the job...");
}

async function monitorTranscodingProgress() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  STEP 5: Monitor Transcoding Progress                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const maxWaitTime = 180000; // 3 minutes max
  const pollInterval = 3000; // 3 seconds
  const startTime = Date.now();

  let lastStatus = "";
  let lastProgress = 0;

  while (Date.now() - startTime < maxWaitTime) {
    const video = await prisma.video.findUnique({
      where: { id: testVideoId },
      select: { processingStatus: true, processingProgress: true, processingError: true },
    });

    if (!video) {
      fail("Video not found");
      return false;
    }

    const status = video.processingStatus;
    const progress = video.processingProgress || 0;

    if (status !== lastStatus || progress !== lastProgress) {
      if (status === "PROCESSING") {
        wait(`Processing: ${progress}%`);
      } else if (status === "READY") {
        pass(`Transcoding complete! Status: ${status}`);
        return true;
      } else if (status === "FAILED") {
        fail(`Transcoding failed: ${video.processingError}`);
        return false;
      } else {
        info(`Status: ${status} (${progress}%)`);
      }
      lastStatus = status;
      lastProgress = progress;
    }

    await sleep(pollInterval);
  }

  const finalVideo = await prisma.video.findUnique({
    where: { id: testVideoId },
    select: { processingStatus: true, processingError: true },
  });

  if (finalVideo?.processingStatus === "READY") {
    pass("Transcoding complete!");
    return true;
  }

  fail(`Timeout (${maxWaitTime / 1000}s). Status: ${finalVideo?.processingStatus}`);
  if (finalVideo?.processingError) {
    info(`Error: ${finalVideo.processingError}`);
  }
  return false;
}

async function verifyTranscodedOutput() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  STEP 6: Verify Transcoded Output                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const video = await prisma.video.findUnique({
    where: { id: testVideoId },
    select: {
      processingStatus: true,
      hlsPlaylistUrl: true,
      thumbnailUrl: true,
      duration: true,
      width: true,
      height: true,
      fps: true,
      resolutions: true,
    },
  });

  if (!video) {
    fail("Video not found");
    return false;
  }

  let success = true;

  if (video.hlsPlaylistUrl) {
    pass(`HLS Playlist: ${video.hlsPlaylistUrl}`);
  } else {
    fail("No HLS playlist URL");
    success = false;
  }

  if (video.thumbnailUrl) {
    pass(`Thumbnail: ${video.thumbnailUrl}`);
  } else {
    info("No thumbnail URL");
  }

  if (video.duration && video.duration > 0) {
    pass(`Duration: ${video.duration} seconds`);
  }

  if (video.width && video.height) {
    pass(`Resolution: ${video.width}x${video.height}`);
  }

  if (video.resolutions && video.resolutions.length > 0) {
    pass(`Qualities: ${video.resolutions.join(", ")}`);
  }

  return success;
}

async function testVideoPlayback() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  STEP 7: Test Video API                                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const res = await fetchJson(`${SERVICES.video}/videos/${testVideoId}`);
  
  if (!res.ok) {
    fail(`API failed: ${res.status}`);
    return false;
  }

  const video = res.data?.data;
  pass(`Video API works`);
  info(`Title: ${video?.title}`);
  info(`Status: ${video?.processingStatus}`);
  
  if (video?.hlsPlaylistUrl) {
    pass(`Playback URL: ${video.hlsPlaylistUrl}`);
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

    if (testVideoId) {
      await prisma.videoReaction.deleteMany({ where: { videoId: testVideoId } });
      await prisma.comment.deleteMany({ where: { videoId: testVideoId } });
      await prisma.video.deleteMany({ where: { id: testVideoId } });
      info("Deleted test video");
    }

    if (testChannelId) {
      await prisma.channel.deleteMany({ where: { id: testChannelId } });
      info("Deleted test channel");
    }

    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
      info("Deleted test user");
    }

    info("MinIO files kept for inspection");
    pass("Cleanup complete");
  } catch (error: any) {
    fail(`Cleanup error: ${error.message}`);
  }
}

// ============== MAIN ==============

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     PLAY PLATFORM - VIDEO PIPELINE E2E TEST                 ║");
  console.log("║     Upload → Transcode → Verify                             ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  let success = true;

  try {
    await connectRabbitMQ();
    await setupTestData();
    const { uploadPath: filePath, fileName } = await uploadVideoToMinio();
    await createVideoRecord(filePath);
    await triggerTranscoding(fileName);

    const transcodeSuccess = await monitorTranscodingProgress();
    if (!transcodeSuccess) success = false;

    if (transcodeSuccess) {
      const outputSuccess = await verifyTranscodedOutput();
      if (!outputSuccess) success = false;
      await testVideoPlayback();
    }

  } catch (error: any) {
    fail(`Pipeline error: ${error.message}`);
    console.error(error);
    success = false;
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  if (success) {
    console.log("║     ✅ VIDEO PIPELINE TEST: PASSED                          ║");
  } else {
    console.log("║     ❌ VIDEO PIPELINE TEST: FAILED                          ║");
  }
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  process.exit(success ? 0 : 1);
}

main();
