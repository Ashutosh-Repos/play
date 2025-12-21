/**
 * API Gateway - Centralized service layer for microservice communication
 * Uses Next.js caching strategies for optimal performance
 */

// Service base URLs
const SERVICES = {
  user: process.env.USER_SERVICE_URL || "http://localhost:4001",
  video: process.env.VIDEO_SERVICE_URL || "http://localhost:4003",
  engagement: process.env.ENGAGEMENT_SERVICE_URL || "http://localhost:4006",
  feed: process.env.FEED_SERVICE_URL || "http://localhost:4010",
  search: process.env.SEARCH_SERVICE_URL || "http://localhost:4009",
  notification: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4011",
} as const;

type ServiceName = keyof typeof SERVICES;

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  cache?: RequestCache;
  revalidate?: number | false;
  tags?: string[];
  token?: string;
  userId?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Internal fetch wrapper with caching and error handling
 */
async function fetchApi<T>(
  service: ServiceName,
  endpoint: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const {
    method = "GET",
    body,
    headers = {},
    cache,
    revalidate,
    tags,
    token,
    userId,
  } = options;

  const url = `${SERVICES[service]}${endpoint}`;

  const fetchOptions: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  // Add auth headers
  if (token) {
    fetchOptions.headers = {
      ...fetchOptions.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  if (userId) {
    fetchOptions.headers = {
      ...fetchOptions.headers,
      "x-user-id": userId,
    };
  }

  // Add body for non-GET requests
  if (body && method !== "GET") {
    fetchOptions.body = JSON.stringify(body);
  }

  // Configure caching
  if (cache) {
    fetchOptions.cache = cache;
  }
  if (revalidate !== undefined || tags) {
    fetchOptions.next = {};
    if (revalidate !== undefined) fetchOptions.next.revalidate = revalidate;
    if (tags) fetchOptions.next.tags = tags;
  }

  try {
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return {
        success: false,
        error: errorData?.error || {
          code: "API_ERROR",
          message: `Request failed: ${response.status} ${response.statusText}`,
        },
      };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API Error [${service}${endpoint}]:`, error);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Network request failed",
      },
    };
  }
}

/**
 * API Gateway with typed service methods
 */
export const api = {
  // User service
  user: {
    getProfile: (userId: string, options?: ApiOptions) =>
      fetchApi(`user`, `/api/v1/users/${userId}`, { ...options, revalidate: 300 }),
    
    getChannel: (handle: string, options?: ApiOptions) =>
      fetchApi(`user`, `/api/v1/channels/${handle}`, { ...options, revalidate: 300 }),
    
    getSubscriptions: (userId: string, options?: ApiOptions) =>
      fetchApi(`user`, `/api/v1/subscriptions?userId=${userId}`, options),
    
    subscribe: (channelId: string, options?: ApiOptions) =>
      fetchApi(`user`, `/api/v1/subscriptions`, { ...options, method: "POST", body: { channelId } }),
  },

  // Video service
  video: {
    list: (params?: { limit?: number; cursor?: string }, options?: ApiOptions) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.cursor) searchParams.set("cursor", params.cursor);
      return fetchApi(`video`, `/videos?${searchParams}`, { ...options, revalidate: 60 });
    },
    
    get: (videoId: string, options?: ApiOptions) =>
      fetchApi(`video`, `/videos/${videoId}`, { ...options, revalidate: 60, tags: [`video-${videoId}`] }),
    
    create: (data: { title: string; description?: string; categoryId?: string }, options?: ApiOptions) =>
      fetchApi(`video`, `/videos`, { ...options, method: "POST", body: data }),
    
    update: (videoId: string, data: Partial<{ title: string; description: string }>, options?: ApiOptions) =>
      fetchApi(`video`, `/videos/${videoId}`, { ...options, method: "PATCH", body: data }),
    
    delete: (videoId: string, options?: ApiOptions) =>
      fetchApi(`video`, `/videos/${videoId}`, { ...options, method: "DELETE" }),
  },

  // Engagement service
  engagement: {
    recordView: (videoId: string, options?: ApiOptions) =>
      fetchApi(`engagement`, `/api/videos/${videoId}/views`, { ...options, method: "POST" }),
    
    toggleLike: (videoId: string, type: "LIKE" | "DISLIKE", options?: ApiOptions) =>
      fetchApi(`engagement`, `/api/videos/${videoId}/reactions`, { ...options, method: "POST", body: { type } }),
    
    getComments: (videoId: string, options?: ApiOptions) =>
      fetchApi(`engagement`, `/api/videos/${videoId}/comments`, { ...options, revalidate: 30 }),
    
    addComment: (videoId: string, content: string, parentId?: string, options?: ApiOptions) =>
      fetchApi(`engagement`, `/api/videos/${videoId}/comments`, { ...options, method: "POST", body: { content, parentId } }),
  },

  // Feed service
  feed: {
    trending: (params?: { limit?: number; cursor?: string }, options?: ApiOptions) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.cursor) searchParams.set("cursor", params.cursor);
      return fetchApi(`feed`, `/api/feed/trending?${searchParams}`, { ...options, revalidate: 60 });
    },
    
    subscriptions: (options?: ApiOptions) =>
      fetchApi(`feed`, `/api/feed/subscriptions`, options),
    
    history: (options?: ApiOptions) =>
      fetchApi(`feed`, `/api/feed/history`, options),
  },

  // Search service
  search: {
    query: (q: string, params?: { limit?: number; offset?: number }, options?: ApiOptions) => {
      const searchParams = new URLSearchParams({ q });
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.offset) searchParams.set("offset", String(params.offset));
      return fetchApi(`search`, `/api/search?${searchParams}`, { ...options, cache: "no-store" });
    },
  },

  // Notification service
  notification: {
    list: (options?: ApiOptions) =>
      fetchApi(`notification`, `/api/notifications`, options),
    
    markRead: (notificationId: string, options?: ApiOptions) =>
      fetchApi(`notification`, `/api/notifications/${notificationId}/read`, { ...options, method: "PATCH" }),
  },
};

export type { ApiOptions, ApiResponse };
