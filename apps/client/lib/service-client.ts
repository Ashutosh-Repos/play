/**
 * Service Client - Token passthrough to microservices
 * 
 * Extracts NextAuth JWT from cookie and passes it to services.
 * Services use verifyToken() which decodes both JWS and JWE tokens.
 */
// Imports for authentication
import { auth } from "@/lib/auth";
import { createServiceToken } from "@repo/common";

// Service base URLs (include /api/v1 prefix where needed)
const SERVICES = {
  // api/v1 suffix
  user: (process.env.USER_SERVICE_URL || "http://localhost:4001") + "/api/v1",
  
  // No suffix (mounts at /videos, /playlists)
  video: process.env.VIDEO_SERVICE_URL || "http://localhost:4003",
  
  // api suffix
  engagement: (process.env.ENGAGEMENT_SERVICE_URL || "http://localhost:4006") + "/api",
  search: (process.env.SEARCH_SERVICE_URL || "http://localhost:4009") + "/api",
  
  // Specific suffixes
  feed: (process.env.FEED_SERVICE_URL || "http://localhost:4010") + "/api/feed",
  notification: (process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4011") + "/api/notifications",
} as const;

type ServiceName = keyof typeof SERVICES;

interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface CallOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Get JWT token for service communication
 * Uses the NextAuth session to create a fresh signed JWS token
 */
async function getAuthToken(): Promise<string | null> {
  const session = await auth();
  
  if (!session?.user) {
    return null;
  }

  // Create a fresh signed token for the service
  // This bypasses JWE decoding complexity and ensures clean service-to-service auth
  return createServiceToken({
    sub: session.user.id,
    email: session.user.email,
    username: session.user.username || "",
    role: session.user.role,
    status: session.user.status,
    channelId: session.user.channelId,
  });
}

/**
 * Make authenticated request to a microservice
 */
export async function serviceCall<T = unknown>(
  service: ServiceName,
  endpoint: string,
  options: CallOptions = {}
): Promise<ServiceResponse<T>> {
  const { body, headers: customHeaders, ...fetchOptions } = options;
  
  const token = await getAuthToken();
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...customHeaders,
  };
  
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const url = `${SERVICES[service]}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error: data?.error || {
          code: "API_ERROR",
          message: `Request failed: ${response.status} ${response.statusText}`,
        },
      };
    }

    return data as ServiceResponse<T>;
  } catch (error) {
    console.error(`Service call failed [${service}${endpoint}]:`, error);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Network request failed",
      },
    };
  }
}

// =============================================================================
// TYPED SERVICE HELPERS
// =============================================================================

// -----------------------------------------------------------------------------
// Channel Service (user-service /channels)
// -----------------------------------------------------------------------------
export const channelService = {
  // GET /channels/me - Get current user's channel
  getMe: () => 
    serviceCall<{
      id: string;
      handle: string;
      displayName: string;
      description: string | null;
      avatarUrl: string | null;
      bannerUrl: string | null;
      isVerified: boolean;
      links: { title: string; url: string }[] | null;
      location: string | null;
      contactEmail: string | null;
      subscriberCount: number;
      videoCount: number;
      totalViews: bigint;
      createdAt: string;
    }>("user", "/channels/me"),

  // GET /channels/:handle - Get channel by handle (public)
  get: (handle: string) => 
    serviceCall("user", `/channels/${handle}`),

  // POST /channels - Create channel
  create: (data: { handle: string; displayName: string; description?: string }) =>
    serviceCall("user", "/channels", { method: "POST", body: data }),

  // PATCH /channels/:handle - Update channel
  update: (handle: string, data: {
    displayName?: string;
    description?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    links?: { title: string; url: string }[];
    location?: string;
    contactEmail?: string;
  }) => serviceCall("user", `/channels/${handle}`, { method: "PATCH", body: data }),

  // DELETE /channels/:handle - Delete channel
  delete: (handle: string) =>
    serviceCall("user", `/channels/${handle}`, { method: "DELETE" }),

  // GET /channels/:handle/subscribers - Get subscribers (owner only)
  getSubscribers: (handle: string, params?: { limit?: number; cursor?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    const query = searchParams.toString();
    return serviceCall("user", `/channels/${handle}/subscribers${query ? `?${query}` : ""}`);
  },

  // GET /channels/:handle/videos - Get public videos for a channel
  getVideos: (handle: string, params?: { limit?: number; cursor?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    const query = searchParams.toString();
    return serviceCall<{
      items: Array<{
        id: string;
        title: string;
        thumbnailUrl: string | null;
        duration: number | null;
        viewCount: number;
        createdAt: string;
        publishedAt: string | null;
      }>;
      nextCursor: string | null;
    }>("user", `/channels/${handle}/videos${query ? `?${query}` : ""}`);
  },
};

// -----------------------------------------------------------------------------
// Subscription Service (user-service /subscriptions)
// -----------------------------------------------------------------------------
export const subscriptionService = {
  // GET /subscriptions - List my subscriptions
  list: (params?: { limit?: number; cursor?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    const query = searchParams.toString();
    return serviceCall<{
      items: Array<{
        id: string;
        notificationLevel: string;
        subscribedAt: string;
        channel: {
          id: string;
          handle: string;
          displayName: string;
          avatarUrl: string | null;
          isVerified: boolean;
          subscriberCount: number;
        };
      }>;
      nextCursor: string | null;
    }>("user", `/subscriptions${query ? `?${query}` : ""}`);
  },

  // POST /subscriptions/:channelId - Subscribe to channel
  subscribe: (channelId: string) =>
    serviceCall("user", `/subscriptions/${channelId}`, { method: "POST" }),

  // DELETE /subscriptions/:channelId - Unsubscribe
  unsubscribe: (channelId: string) =>
    serviceCall("user", `/subscriptions/${channelId}`, { method: "DELETE" }),

  // GET /subscriptions/:channelId/status - Check subscription status
  status: (channelId: string) =>
    serviceCall<{
      subscribed: boolean;
      subscription: { id: string; notificationLevel: string; subscribedAt: string } | null;
    }>("user", `/subscriptions/${channelId}/status`),

  // PATCH /subscriptions/:channelId - Update notification level
  updateNotification: (channelId: string, notificationLevel: "ALL" | "PERSONALIZED" | "NONE") =>
    serviceCall("user", `/subscriptions/${channelId}`, { method: "PATCH", body: { notificationLevel } }),
};

// -----------------------------------------------------------------------------
// User Service (user-service /users)
// -----------------------------------------------------------------------------
export const profileService = {
  // GET /users/me - Current user profile
  getMe: () =>
    serviceCall<{
      id: string;
      email: string;
      emailVerified: boolean;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      bio: string | null;
      role: string;
      status: string;
      createdAt: string;
      channel: {
        id: string;
        handle: string;
        displayName: string;
        avatarUrl: string | null;
        bannerUrl: string | null;
        isVerified: boolean;
        subscriberCount: number;
        videoCount: number;
      } | null;
    }>("user", "/users/me"),

  // PATCH /users/me - Update profile
  update: (data: { displayName?: string; bio?: string; avatarUrl?: string }) =>
    serviceCall("user", "/users/me", { method: "PATCH", body: data }),

  // GET /users/:id - Get public profile
  get: (userId: string) =>
    serviceCall("user", `/users/${userId}`),

  // GET /users/username/:username - Get by username
  getByUsername: (username: string) =>
    serviceCall("user", `/users/username/${username}`),
};

// -----------------------------------------------------------------------------
// Account Service (user-service /account)
// -----------------------------------------------------------------------------
export const accountService = {
  // GET /account/info - Account info (hasPassword, cooldown)
  getInfo: () =>
    serviceCall<{
      hasPassword: boolean;
      username: string;
      usernameCooldownUntil: string | null;
    }>("user", "/account/info"),

  // GET /account/sessions - List active sessions (pass tokenId for current marking)
  getSessions: (tokenId?: string) =>
    serviceCall<Array<{
      id: string;
      userAgent: string | null;
      ipAddress: string | null;
      createdAt: string;
      expiresAt: string;
      current: boolean;
    }>>("user", "/account/sessions", tokenId ? {
      headers: { "x-token-id": tokenId },
    } : {}),

  // DELETE /account/sessions/:id - Revoke session
  revokeSession: (sessionId: string) =>
    serviceCall("user", `/account/sessions/${sessionId}`, { method: "DELETE" }),

  // DELETE /account/sessions/others - Revoke all except current
  revokeOtherSessions: (currentTokenId: string) =>
    serviceCall("user", "/account/sessions/others", { 
      method: "DELETE",
      headers: { "x-token-id": currentTokenId },
    }),

  // GET /account/connections - List OAuth connections
  getConnections: () =>
    serviceCall<Array<{
      id: string;
      provider: string;
      createdAt: string;
    }>>("user", "/account/connections"),

  // DELETE /account/connections/:provider - Unlink OAuth
  unlinkConnection: (provider: string) =>
    serviceCall("user", `/account/connections/${provider}`, { method: "DELETE" }),

  // POST /account/password - Set password (for OAuth users)
  setPassword: (password: string) =>
    serviceCall("user", "/account/password", { method: "POST", body: { password } }),

  // PATCH /account/password - Change password
  changePassword: (currentPassword: string, newPassword: string) =>
    serviceCall("user", "/account/password", { 
      method: "PATCH", 
      body: { currentPassword, newPassword } 
    }),

  // DELETE /account - Request account deletion
  deleteAccount: (password?: string) =>
    serviceCall("user", "/account", { 
      method: "DELETE", 
      ...(password && { body: { password } })
    }),

  // PATCH /account/username - Change username (rate limited)
  changeUsername: (username: string) =>
    serviceCall<{ message: string; username: string }>("user", "/account/username", { 
      method: "PATCH", 
      body: { username } 
    }),

  // POST /account/restore - Cancel account deletion
  restoreAccount: () =>
    serviceCall("user", "/account/restore", { method: "POST" }),
};

// -----------------------------------------------------------------------------
// Settings Service (user-service /settings)
// -----------------------------------------------------------------------------
export const settingsService = {
  // GET /settings/notifications - Get notification settings
  getNotifications: () =>
    serviceCall<{
      newVideos: boolean;
      liveStreams: boolean;
      comments: boolean;
      replies: boolean;
      likes: boolean;
      subscribers: boolean;
      mentions: boolean;
      emailEnabled: boolean;
      pushEnabled: boolean;
    }>("user", "/settings/notifications"),

  // PATCH /settings/notifications - Update notification settings
  updateNotifications: (settings: {
    newVideos?: boolean;
    liveStreams?: boolean;
    comments?: boolean;
    replies?: boolean;
    likes?: boolean;
    subscribers?: boolean;
    mentions?: boolean;
    emailEnabled?: boolean;
    pushEnabled?: boolean;
  }) => serviceCall("user", "/settings/notifications", { method: "PATCH", body: settings }),
};

// -----------------------------------------------------------------------------
// Video Service (video-service /videos)
// -----------------------------------------------------------------------------
export const videoService = {
  get: (videoId: string) =>
    serviceCall("video", `/videos/${videoId}`),

  list: (params?: { limit?: number; cursor?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    return serviceCall("video", `/videos?${searchParams}`);
  },
};

// Legacy alias for backwards compatibility
export const userService = channelService;

