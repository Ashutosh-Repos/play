// Shared type definitions
export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  userId: string;
  status: VideoStatus;
  duration?: number;
  thumbnailUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type VideoStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
