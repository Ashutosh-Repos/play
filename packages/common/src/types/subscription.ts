// Subscription types aligned with Prisma schema

import type { ChannelSummary } from "./channel";

/**
 * Subscription notification level
 */
export type SubscriptionNotificationLevel = "ALL" | "PERSONALIZED" | "NONE";

/**
 * Subscription list item
 */
export interface SubscriptionItem {
  id: string;
  notificationLevel: SubscriptionNotificationLevel;
  subscribedAt: Date;
  channel: ChannelSummary;
}

/**
 * Subscription status check result
 */
export interface SubscriptionStatus {
  subscribed: boolean;
  subscription: {
    id: string;
    notificationLevel: SubscriptionNotificationLevel;
    subscribedAt: Date;
  } | null;
}

/**
 * Subscriber info (for channel owner view)
 */
export interface SubscriberInfo {
  id: string;
  subscribedAt: Date;
  notificationLevel: SubscriptionNotificationLevel;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}
