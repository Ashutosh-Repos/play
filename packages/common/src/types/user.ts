// User and Channel types aligned with Prisma schema

export type UserRole = "USER" | "ADMIN";
export enum UserStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  BANNED = "BANNED",
  PROVISIONED = "PROVISIONED",
}
/**
 * User - core user data
 */
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  deletedAt?: Date;
}

/**
 * User with channel info
 */
export interface UserWithChannel extends User {
  channel?: Channel;
}

/**
 * Channel - creator channel
 */
export interface Channel {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  description?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  isVerified: boolean;
  subscriberCount: number;
  videoCount: number;
  totalViews: bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * Public channel view (for API responses)
 */
export interface PublicChannel {
  id: string;
  handle: string;
  displayName: string;
  description?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  isVerified: boolean;
  subscriberCount: number;
  videoCount: number;
}

/**
 * Subscription
 */
export interface Subscription {
  id: string;
  subscriberId: string;
  channelId: string;
  notificationLevel: "ALL" | "PERSONALIZED" | "NONE";
  subscribedAt: Date;
}

/**
 * Create user input
 */
export interface CreateUserInput {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

/**
 * Update user input
 */
export interface UpdateUserInput {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
}

/**
 * Create channel input
 */
export interface CreateChannelInput {
  handle: string;
  displayName: string;
  description?: string;
}

/**
 * Update channel input
 */
export interface UpdateChannelInput {
  displayName?: string;
  description?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  links?: Array<{ title: string; url: string }>;
  location?: string;
  contactEmail?: string;
}
