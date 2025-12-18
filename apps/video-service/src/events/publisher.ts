// RabbitMQ event publisher with outbox pattern for reliability
import * as amqp from "amqplib";
import { prisma } from "@repo/database";
import { EXCHANGES, ROUTING_KEYS } from "@repo/events";
import { config } from "../config.js";

let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
let channel: amqp.Channel | null = null;

export async function connectRabbitMQ(): Promise<void> {
  const url = config.rabbitmqUrl;

  try {
    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    // Declare exchanges
    await channel.assertExchange(EXCHANGES.VIDEO, "topic", { durable: true });

    console.log("✅ video-service connected to RabbitMQ");
  } catch (error) {
    console.error("❌ Failed to connect to RabbitMQ:", error);
    throw error;
  }
}

export async function closeRabbitMQ(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
}

function publish(routingKey: string, message: object): void {
  if (!channel) {
    console.warn("RabbitMQ channel not initialized");
    return;
  }

  channel.publish(
    EXCHANGES.VIDEO,
    routingKey,
    Buffer.from(JSON.stringify(message)),
    { persistent: true }
  );
}

// ==================== Outbox Pattern ====================

interface OutboxEntry {
  eventType: string;
  routingKey: string;
  payload: object;
}

/**
 * Save event to outbox and emit (used within transactions)
 * Returns the outbox entry ID
 */
export async function saveToOutbox(entry: OutboxEntry, tx: any = prisma): Promise<string> {
  const outboxEvent = await tx.outboxEvent.create({
    data: {
      eventType: entry.eventType,
      payload: entry.payload as object,
    },
  });
  return outboxEvent.id;
}

/**
 * Emit event and mark outbox as processed
 */
export async function emitAndMarkProcessed(
  outboxId: string,
  routingKey: string,
  message: object
): Promise<void> {
  publish(routingKey, message);
  
  await prisma.outboxEvent.update({
    where: { id: outboxId },
    data: { processedAt: new Date() },
  });
}

/**
 * Process a specific outbox item (used for immediate emit after transaction)
 */
export async function processOutboxItem(outboxId: string): Promise<void> {
  const event = await prisma.outboxEvent.findUnique({
    where: { id: outboxId },
  });
  
  if (!event || event.processedAt) return;
  
  // We need routing key. Currently not stored in outbox event model explicitly??
  // Wait, schema check.
  // model OutboxEvent { ... eventType, payload ... } - NO ROUTING KEY in schema!
  
  // Checking schema again...
  // model OutboxEvent { id, eventType, payload, createdAt, processedAt }
  
  // The 'routingKey' is missing from the DB model!
  // 'publisher.ts': saveToOutbox takes 'routingKey' but DOES NOT SAVE IT.
  // It saves eventType and payload.
  
  // ERROR: We assume we can derive routingKey from eventType?
  // Or we need to add routingKey to the schema?
  
  // Let's check saveToOutbox implementation again.
  // export async function saveToOutbox(entry: OutboxEntry, ...): Promise<string> {
  //   const outboxEvent = await tx.outboxEvent.create({
  //     data: {
  //       eventType: entry.eventType,
  //       payload: entry.payload as object,
  //     },
  //   });
  //   return outboxEvent.id;
  // }
  
  // It DROPS the routingKey.
  // So 'processOutboxItem' cannot know where to publish unless we map eventType -> routingKey.
  
  // We should fix the Schema to include routingKey, or map it.
  // Mapping is easier for now to avoid another migration.
  
  let routingKey = "";
  if (event.eventType === "video.published") routingKey = ROUTING_KEYS.VIDEO_PUBLISHED;
  else if (event.eventType === "video.uploaded") routingKey = ROUTING_KEYS.VIDEO_UPLOADED;
  else if (event.eventType === "video.deleted") routingKey = ROUTING_KEYS.VIDEO_DELETED;
  else if (event.eventType === "video.updated") routingKey = "video.updated"; // Check this constant
  else return; // Unknown event type
  
  publish(routingKey, event.payload as object);
  
  await prisma.outboxEvent.update({
    where: { id: outboxId },
    data: { processedAt: new Date() },
  });
}

/**
 * Publish an event with outbox pattern (atomic with DB update)
 * Use inside prisma.$transaction
 */
/**
 * Publish an event with outbox pattern (atomic with DB update)
 * Use inside prisma.$transaction
 */
export async function publishWithOutbox(
  routingKey: string,
  eventType: string,
  payload: object,
  tx: any = prisma
): Promise<string | void> {
  // Save to outbox
  const outboxId = await saveToOutbox({
    eventType,
    routingKey,
    payload,
  }, tx);
  
  // If we are in a transaction (tx !== prisma usually implies this, though weak check)
  // or simply, if the caller intends to handle the emit later.
  // BUT to detect if we should emit now:
  // If 'tx' was passed explicitly, we assume the caller handles the transaction commit.
  // We cannot emit securely until commit. 
  // So we return early. The background job will pick it up, or caller must emit.
  
  if (tx !== prisma) {
    return outboxId;
  }
  
  // Try to emit immediately if not in external transaction
  try {
    publish(routingKey, { type: eventType, payload });
    
    // Mark as processed
    await prisma.outboxEvent.update({
      where: { id: outboxId },
      data: { processedAt: new Date() },
    });
  } catch (error) {
    // If emit fails, the background job will retry
    console.error("Failed to emit event:", error);
  }
  
  return outboxId;
}


// ==================== Event Publishers ====================

// Replaces emitVideoCreated (which seems wrong/unused based on context) or adds parallel
export function emitVideoUploaded(
  videoId: string,
  userId: string,
  fileName: string,
  fileSize: number,
  mimeType: string
): void {
  publish(ROUTING_KEYS.VIDEO_UPLOADED, {
    type: "video.uploaded",
    payload: {
      videoId,
      userId,
      fileName,
      fileSize,
      mimeType,
      uploadedAt: new Date().toISOString(),
    },
  });
}

export async function emitVideoPublished(
  videoId: string,
  channelId: string,
  title: string,
  thumbnailUrl: string | null,
  duration: number | null,
  visibility: string,
  tx: any = prisma
): Promise<string | void> {
  const payload = {
    videoId,
    channelId,
    title,
    thumbnailUrl,
    duration,
    visibility,
    publishedAt: new Date().toISOString(),
  };
  
  // Use outbox pattern for critical event
  return publishWithOutbox(
    ROUTING_KEYS.VIDEO_PUBLISHED,
    "video.published",
    payload,
    tx
  );
}

export function emitVideoUpdated(
  videoId: string,
  channelId: string,
  changedFields: string[]
): void {
  publish("video.updated", {
    type: "video.updated",
    payload: {
      videoId,
      channelId,
      changedFields,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function emitVideoDeleted(
  videoId: string,
  channelId: string,
  tx: any = prisma
): Promise<string | void> {
  const payload = {
    videoId,
    channelId,
    deletedAt: new Date().toISOString(),
  };
  
  // Use outbox pattern for critical event
  return publishWithOutbox(
    ROUTING_KEYS.VIDEO_DELETED,
    "video.deleted",
    payload,
    tx
  );
}
