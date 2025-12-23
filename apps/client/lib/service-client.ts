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
    console.warn("[ServiceClient] No session found during token generation");
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
    
    if (!response.ok) {
        console.error(`[ServiceClient] Request failed: ${response.status} ${response.statusText} URL: ${url}`);
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
// -----------------------------------------------------------------------------
// Video Service (video-service /videos)
// -----------------------------------------------------------------------------
export const videoService = {
  // --- Video Management ---
  
  // POST /videos - Create draft
  create: (data: { 
    title: string; 
    description?: string; 
    categoryId?: string;
    tags?: string[];
    language?: string;
    visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED" | "SCHEDULED";
  }) => serviceCall("video", "/videos", { method: "POST", body: data }),

  // PATCH /videos/:id - Update video
  update: (id: string, data: {
    title?: string;
    description?: string;
    tags?: string[];
    thumbnailUrl?: string;
    visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED" | "SCHEDULED";
    allowComments?: boolean;
    allowEmbedding?: boolean;
    isAgeRestricted?: boolean;
  }) => serviceCall("video", `/videos/${id}`, { method: "PATCH", body: data }),

  // DELETE /videos/:id - Delete video
  delete: (id: string) => 
    serviceCall("video", `/videos/${id}`, { method: "DELETE" }),

  // POST /videos/:id/publish - Publish video
  publish: (id: string, data: { 
    visibility: "PUBLIC" | "UNLISTED" | "SCHEDULED"; 
    scheduledAt?: Date 
  }) => serviceCall("video", `/videos/${id}/publish`, { method: "POST", body: data }),

  // --- Retrieval ---

  // GET /videos/:id - Get public video details
  get: (videoId: string) =>
    serviceCall<{
      id: string;
      title: string;
      description: string | null;
      tags: string[];
      visibility: string;
      processingStatus: string;
      hlsPlaylistUrl: string | null;
      thumbnailUrl: string | null;
      previewSprite: string | null;
      duration: number | null;
      viewCount: number;
      likeCount: number;
      dislikeCount: number;
      commentCount: number;
      publishedAt: string | null;
      createdAt: string;
      channel: {
        id: string;
        handle: string;
        displayName: string;
        avatarUrl: string | null;
        subscriberCount: number;
        isVerified: boolean;
      };
      category?: {
        id: string;
        name: string;
        slug: string;
      };
    }>("video", `/videos/${videoId}`),

  // GET /videos/:id/status - Get processing status
  getStatus: (videoId: string) =>
    serviceCall<{
      id: string;
      status: string;
      progress: number;
      error: string | null;
      thumbnailOptions: string[];
      canPublish: boolean;
    }>("video", `/videos/${videoId}/status`),

  // GET /videos/me - List my videos
  getMyVideos: (params?: { limit?: number; cursor?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.status) searchParams.set("status", params.status);
    return serviceCall<{
      items: Array<{
        id: string;
        title: string;
        thumbnailUrl: string | null;
        visibility: string;
        processingStatus: string;
        viewCount: number;
        likeCount: number;
        commentCount: number;
        createdAt: string;
        publishedAt: string | null;
        duration: number | null;
      }>;
      nextCursor: string | null;
    }>("video", `/videos/me?${searchParams}`);
  },

  // GET /videos - Public feed
  getFeed: (params?: { limit?: number; cursor?: string; sort?: "latest" | "popular" }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.sort) searchParams.set("sort", params.sort);
    return serviceCall<{
      items: Array<{
        id: string;
        title: string;
        thumbnailUrl: string;
        viewCount: number;
        publishedAt: string;
        duration: number | null;
        channelName: string;
        channelHandle: string;
        channelAvatarUrl: string | null;
      }>;
      nextCursor: string | null;
    }>("video", `/videos?${searchParams}`);
  },

  // --- Upload Flow ---

  // Initiate upload - Get presigned URL
  initiateUpload: (filename: string) =>
    serviceCall<{
      videoId: string;
      uploadUrl: string;
      wsUrl: string;
      expiresAt: string;
    }>("video", "/videos/upload", {
      method: "POST",
      body: { fileName: filename },
    }),

  // Retry upload - Get new presigned URL
  retryUpload: (videoId: string) =>
    serviceCall<{
      videoId: string;
      uploadUrl: string;
      wsUrl: string;
      expiresAt: string;
    }>("video", `/videos/upload/${videoId}/retry`, {
      method: "POST",
    }),

  // Confirm upload complete (fallback if S3 event missed)
  completeUpload: (videoId: string) =>
    serviceCall<{ status: string }>("video", `/videos/upload/${videoId}/uploaded`, {
      method: "POST",
    }),
};

// -----------------------------------------------------------------------------
// Playlist Service (video-service /playlists)
// -----------------------------------------------------------------------------
export const playlistService = {
  // GET /playlists/me
  getMyPlaylists: (params?: { limit?: number; cursor?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    return serviceCall<{
      items: Array<{
        id: string;
        title: string;
        description: string | null;
        visibility: string;
        thumbnailUrl: string | null;
        videoCount: number;
        updatedAt: string;
        isSystem?: boolean;
      }>;
      nextCursor: string | null;
    }>("video", `/playlists/me?${searchParams}`);
  },

  // POST /playlists
  create: (data: { title: string; description?: string; visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED" }) =>
    serviceCall<{
      id: string;
      title: string;
      description: string | null;
      visibility: string;
      videoCount: number;
      createdAt: string;
    }>("video", "/playlists", { method: "POST", body: data }),

  // GET /playlists/:id
  get: (id: string, publicView = true) => 
    serviceCall<{
      id: string;
      title: string;
      description: string | null;
      visibility: string;
      thumbnailUrl: string | null;
      userId: string;
      videoCount: number;
      updatedAt: string;
      videos: Array<{
        id: string;
        title: string;
        thumbnailUrl: string | null;
        channelName: string;
        channelHandle: string;
        viewCount: number;
        duration: number | null;
        publishedAt: string | null;
        visibility: string;
        position?: number;
      }>;
    }>("video", `/playlists/${id}`),

  // PATCH /playlists/:id
  update: (id: string, data: { title?: string; description?: string; visibility?: string }) =>
    serviceCall("video", `/playlists/${id}`, { method: "PATCH", body: data }),

  // DELETE /playlists/:id
  delete: (id: string) =>
    serviceCall("video", `/playlists/${id}`, { method: "DELETE" }),

  // POST /playlists/:id/videos
  addVideo: (id: string, videoId: string) =>
    serviceCall<{ added: boolean; position: number }>("video", `/playlists/${id}/videos`, { method: "POST", body: { videoId } }),

  // DELETE /playlists/:id/videos/:videoId
  removeVideo: (id: string, videoId: string) =>
    serviceCall("video", `/playlists/${id}/videos/${videoId}`, { method: "DELETE" }),
  
  // PATCH /playlists/:id/videos/reorder
  reorderVideos: (id: string, videoIds: string[]) =>
    serviceCall("video", `/playlists/${id}/videos/reorder`, { method: "PATCH", body: { videoIds } }),
};

// -----------------------------------------------------------------------------
// Category Service (video-service /categories)
// -----------------------------------------------------------------------------
export const categoryService = {
  // GET /categories
  getAll: () =>
    serviceCall<Array<{
      id: string;
      name: string;
      slug: string;
      iconUrl: string | null;
    }>>("video", "/categories"),

  // GET /categories/:slug
  get: (slug: string) =>
    serviceCall("video", `/categories/${slug}`),

  // GET /categories/:slug/videos
  getVideos: (slug: string, params?: { limit?: number; cursor?: string; sort?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.sort) searchParams.set("sort", params.sort);
    return serviceCall<{
      category: { id: string; name: string };
      items: Array<{
        id: string;
        title: string;
        thumbnailUrl: string;
        viewCount: number;
        publishedAt: string;
        duration: number | null;
        channelName: string;
        channelHandle: string;
        channelAvatarUrl: string | null;
      }>;
      nextCursor: string | null;
    }>("video", `/categories/${slug}/videos?${searchParams}`);
  },
};

// -----------------------------------------------------------------------------
// Engagement Service (engagement-service /api)
// -----------------------------------------------------------------------------
export const engagementService = {
  // --- Reactions ---
  
  // POST /videos/:id/reaction - Toggle like/dislike
  toggleReaction: (videoId: string, type: "LIKE" | "DISLIKE") =>
    serviceCall<{
      reaction: "LIKE" | "DISLIKE" | null;
      likeCount: number;
      dislikeCount: number;
    }>("engagement", `/videos/${videoId}/reaction`, { method: "POST", body: { type } }),

  // GET /videos/:id/reaction - Get my reaction
  getMyReaction: (videoId: string) =>
    serviceCall<{
      reaction: "LIKE" | "DISLIKE" | null;
    }>("engagement", `/videos/${videoId}/reaction`),

  // --- Comments ---

  // GET /videos/:id/comments - List comments
  getComments: (videoId: string, params?: { limit?: number; cursor?: string; sort?: "NEWEST" | "POPULAR" }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.sort) searchParams.set("sort", params.sort);
    return serviceCall<{
      items: Array<{
        id: string;
        content: string;
        createdAt: string;
        updatedAt: string;
        isPinned: boolean;
        isHearted: boolean;
        likeCount: number;
        replyCount: number;
        userReaction: "LIKE" | null; // Engagement service might return this if implemented
        author: {
          id: string;
          username: string;
          displayName: string;
          avatarUrl: string | null;
          isVerified: boolean;
          isChannelOwner: boolean; // Computed by service
        };
      }>;
      nextCursor: string | null;
    }>("engagement", `/videos/${videoId}/comments?${searchParams}`);
  },

  // POST /videos/:id/comments - Post comment
  postComment: (videoId: string, content: string) =>
    serviceCall("engagement", `/videos/${videoId}/comments`, { method: "POST", body: { content } }),

  // DELETE /comments/:id - Delete comment
  deleteComment: (commentId: string) =>
    serviceCall("engagement", `/comments/${commentId}`, { method: "DELETE" }),

  // --- Views ---

  // POST /videos/:id/view - Record view
  recordView: (videoId: string) =>
    serviceCall("engagement", `/videos/${videoId}/view`, { method: "POST" }),
};


// -----------------------------------------------------------------------------
// Feed Service (feed-service /api/feed)
// -----------------------------------------------------------------------------
export const feedService = {
  // GET /api/feed/home - Home feed (currently alias for trending)
  getHome: (params?: { limit?: number; cursor?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    const query = searchParams.toString();
    
    return serviceCall<{
      videos: Array<{
        id: string;
        title: string;
        thumbnailUrl: string;
        viewCount: number;
        publishedAt: string;
        createdAt: string;
        duration: number | null;
        channelName: string;
        channelHandle: string;
        channelAvatarUrl: string | null;
        likeCount: number;
        commentCount: number;
      }>;
      nextCursor: string | null;
    }>("feed", `/home${query ? `?${query}` : ""}`);
  },

  // GET /api/feed/trending
  getTrending: (params?: { limit?: number; cursor?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    const query = searchParams.toString();
    
    return serviceCall<{
      videos: Array<{
        id: string;
        title: string;
        thumbnailUrl: string;
        viewCount: number;
        publishedAt: string;
        createdAt: string;
        duration: number | null;
        channelName: string;
        channelHandle: string;
        channelAvatarUrl: string | null;
        likeCount: number;
        commentCount: number;
      }>;
      nextCursor: string | null;
    }>("feed", `/trending${query ? `?${query}` : ""}`);
  },

  // GET /api/feed/subscriptions
  getSubscriptions: (params?: { limit?: number; cursor?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    const query = searchParams.toString();
    
    return serviceCall<{
      videos: Array<{
        id: string;
        title: string;
        thumbnailUrl: string;
        viewCount: number;
        publishedAt: string;
        createdAt: string;
        duration: number | null;
        channelName: string;
        channelHandle: string;
        channelAvatarUrl: string | null;
        likeCount: number;
        commentCount: number;
      }>;
      nextCursor: string | null;
    }>("feed", `/subscriptions${query ? `?${query}` : ""}`);
  },

  // GET /api/feed/history
  getHistory: (params?: { limit?: number; cursor?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    const query = searchParams.toString();
    
    return serviceCall<{
      videos: Array<{
        id: string;
        title: string;
        thumbnailUrl: string;
        viewCount: number;
        publishedAt: string;
        createdAt: string;
        duration: number | null;
        channelName: string;
        channelHandle: string;
        channelAvatarUrl: string | null;
        likeCount: number;
        commentCount: number;
        watchedAt?: string;
        watchCount?: number;
      }>;
      nextCursor: string | null;
    }>("feed", `/history${query ? `?${query}` : ""}`);
  },
};

// -----------------------------------------------------------------------------
// Search Service (search-service /api)
// -----------------------------------------------------------------------------
export const searchService = {
  // GET /search
  search: (query: string, params?: { page?: number; limit?: number; sort?: "relevancy" | "newest" | "popular" }) => {
    const searchParams = new URLSearchParams();
    searchParams.set("q", query);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.sort) searchParams.set("sort", params.sort);

    return serviceCall<{
      hits: Array<{
        id: string;
        title: string;
        description: string;
        thumbnailUrl: string | null;
        viewCount: number;
        duration: number | null;
        createdAt: number;
        channelName: string;
        channelHandle: string;
        channelAvatarUrl: string | null;
      }>;
      estimatedTotalHits: number;
      processingTimeMs: number;
      page: number;
      totalPages: number;
    }>("search", `/search?${searchParams}`);
  },
};

// Legacy alias for backwards compatibility
export const userService = channelService;

