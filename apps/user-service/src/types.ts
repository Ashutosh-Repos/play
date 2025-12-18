// Response types for user-service
export interface UserProfile {
  id: string;
  email?: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  role?: string;
  status?: string;
  createdAt: Date;
  channel?: ChannelSummary | null;
}

export interface ChannelSummary {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  subscriberCount: number;
}

export interface ChannelDetail {
  id: string;
  handle: string;
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isVerified: boolean;
  links: ChannelLink[] | null;
  location: string | null;
  contactEmail: string | null;
  subscriberCount: number;
  videoCount: number;
  totalViews: bigint;
  createdAt: Date;
  user?: { id: string; username: string };
}

export interface ChannelLink {
  title: string;
  url: string;
}

export interface SubscriptionItem {
  id: string;
  notificationLevel: "ALL" | "PERSONALIZED" | "NONE";
  subscribedAt: Date;
  channel: ChannelSummary;
}

export interface SubscriptionStatus {
  subscribed: boolean;
  subscription: {
    id: string;
    notificationLevel: string;
    subscribedAt: Date;
  } | null;
}

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface OAuthConnection {
  id: string;
  provider: string;
  createdAt: Date;
}

export interface NotificationSettings {
  newVideos: boolean;
  liveStreams: boolean;
  comments: boolean;
  replies: boolean;
  likes: boolean;
  subscribers: boolean;
  mentions: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}
