// RabbitMQ event publisher for user-service
import * as amqp from "amqplib";
import {
  EXCHANGES,
  ROUTING_KEYS,
  UserUpdatedEvent,
  UserDeletedEvent,
  UserSuspendedEvent,
  UserRestoredEvent,
  ChannelCreatedEvent,
  ChannelUpdatedEvent,
  ChannelDeletedEvent,
  ChannelVerifiedEvent,
  SubscriptionCreatedEvent,
  SubscriptionDeletedEvent,
} from "@repo/events";

let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
let channel: amqp.Channel | null = null;

export async function connectRabbitMQ(): Promise<void> {
  const url = process.env.RABBITMQ_URL || "amqp://localhost:5672";

  try {
    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    // Declare exchange
    await channel.assertExchange(EXCHANGES.USER, "topic", { durable: true });

    console.log("✅ Connected to RabbitMQ");
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
    EXCHANGES.USER,
    routingKey,
    Buffer.from(JSON.stringify(message)),
    { persistent: true }
  );
}

// ==================== Event Publishers ====================

export function emitUserUpdated(
  userId: string,
  changes: Record<string, unknown>
): void {
  const event: UserUpdatedEvent = {
    type: "user.updated",
    payload: {
      userId,
      changes,
      updatedAt: new Date().toISOString(),
    },
  };
  publish(ROUTING_KEYS.USER_UPDATED, event);
}

export function emitUserDeleted(userId: string): void {
  const event: UserDeletedEvent = {
    type: "user.deleted",
    payload: {
      userId,
      deletedAt: new Date().toISOString(),
    },
  };
  publish(ROUTING_KEYS.USER_DELETED, event);
}

export function emitUserSuspended(
  userId: string,
  reason: string,
  until?: string
): void {
  const event: UserSuspendedEvent = {
    type: "user.suspended",
    payload: {
      userId,
      reason,
      until,
      suspendedAt: new Date().toISOString(),
    },
  };
  publish(ROUTING_KEYS.USER_SUSPENDED, event);
}

export function emitChannelCreated(
  channelId: string,
  userId: string,
  handle: string
): void {
  const event: ChannelCreatedEvent = {
    type: "channel.created",
    payload: {
      channelId,
      userId,
      handle,
      createdAt: new Date().toISOString(),
    },
  };
  publish(ROUTING_KEYS.CHANNEL_CREATED, event);
}

export function emitChannelUpdated(
  channelId: string,
  changes: Record<string, unknown>
): void {
  const event: ChannelUpdatedEvent = {
    type: "channel.updated",
    payload: {
      channelId,
      changes,
      updatedAt: new Date().toISOString(),
    },
  };
  publish(ROUTING_KEYS.CHANNEL_UPDATED, event);
}

export function emitChannelVerified(channelId: string): void {
  const event: ChannelVerifiedEvent = {
    type: "channel.verified",
    payload: {
      channelId,
      verifiedAt: new Date().toISOString(),
    },
  };
  publish(ROUTING_KEYS.CHANNEL_VERIFIED, event);
}

export function emitSubscriptionCreated(
  subscriberId: string,
  channelId: string
): void {
  const event: SubscriptionCreatedEvent = {
    type: "subscription.created",
    payload: {
      subscriberId,
      channelId,
      subscribedAt: new Date().toISOString(),
    },
  };
  publish(ROUTING_KEYS.SUBSCRIPTION_CREATED, event);
}

export function emitSubscriptionDeleted(
  subscriberId: string,
  channelId: string
): void {
  const event: SubscriptionDeletedEvent = {
    type: "subscription.deleted",
    payload: {
      subscriberId,
      channelId,
      deletedAt: new Date().toISOString(),
    },
  };
  publish(ROUTING_KEYS.SUBSCRIPTION_DELETED, event);
}

export function emitUserRestored(userId: string): void {
  const event: UserRestoredEvent = {
    type: "user.restored",
    payload: {
      userId,
      restoredAt: new Date().toISOString(),
    },
  };
  publish(ROUTING_KEYS.USER_RESTORED, event);
}

export function emitChannelDeleted(channelId: string, userId: string): void {
  const event: ChannelDeletedEvent = {
    type: "channel.deleted",
    payload: {
      channelId,
      userId,
      deletedAt: new Date().toISOString(),
    },
  };
  publish(ROUTING_KEYS.CHANNEL_DELETED, event);
}
