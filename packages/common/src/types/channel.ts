// Extended channel types (supplements user.ts Channel type)
// Core Channel types are in user.ts

/**
 * Channel link (social media, website, etc.)
 */
export interface ChannelLink {
  title: string;
  url: string;
}

/**
 * Channel summary for lists and embeds (lightweight)
 */
export interface ChannelSummary {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  subscriberCount: number;
}

/**
 * Channel with extended info (for channel page)
 */
export interface ChannelDetail extends ChannelSummary {
  description: string | null;
  bannerUrl: string | null;
  links: ChannelLink[] | null;
  location: string | null;
  contactEmail: string | null;
  videoCount: number;
  totalViews: number; // Using number instead of bigint for JSON serialization
  createdAt: Date;
}

/**
 * Channel with owner info
 */
export interface ChannelWithOwner extends ChannelDetail {
  user?: {
    id: string;
    username: string;
    displayName: string;
  };
}
