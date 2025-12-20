import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

// Re-export Prisma types and enums with named exports (avoids Turbopack warning)
export { PrismaClient, Prisma } from "@prisma/client";

// Export commonly used enums (matching schema.prisma)
export {
  ProcessingStatus,
  VideoVisibility,
  UserRole,
  UserStatus,
  ReactionType,
  CommentStatus,
  NotificationType,
  LiveStreamStatus,
  ReportStatus,
  ReportReason,
  SubscriptionNotificationLevel,
} from "@prisma/client";

// Export types
export type {
  User,
  Channel,
  Video,
  Comment,
  VideoReaction,
  Subscription,
  WatchHistory,
  Notification,
  NotificationSettings,
  Playlist,
  LiveStream,
  Report,
  RefreshToken,
  OAuthIdentity,
} from "@prisma/client";
