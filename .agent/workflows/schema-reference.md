---
description: Database schema reference for Play video streaming platform
---

# Play Platform Database Schema Reference

## Overview

- **Database**: PostgreSQL with Prisma ORM
- **Schema Location**: `packages/database/prisma/schema.prisma`
- **Models**: 24 | **Enums**: 14 | **Indexes**: 82+

## Architecture

```
PostgreSQL (source of truth) ─┬─ Redis (caching, real-time counters)
                              ├─ ClickHouse (analytics)
                              └─ Meilisearch (search)
```

## Service → Model Mapping

| Service | Models |
|---------|--------|
| user-service | User, OAuthIdentity, Channel, Subscription |
| video-service | Video, Playlist, PlaylistVideo, Category |
| ingest-service | Video (upload fields) |
| transcoder-service | Video (processing fields) |
| engagement-service | Comment, VideoReaction, CommentReaction, VideoStats |
| notification-service | Notification, NotificationSettings |
| feed-service | Video, Subscription, WatchHistory, UserInterest, VideoStats |
| search-service | Video, Channel, LiveStream (read for indexing) |
| analytics-service | ClickHouse tables (not in Prisma) |
| live-service | LiveStream, LiveChat |

## Models Summary

### Auth Domain
- **User**: id, email, username(@30), displayName(@50), passwordHash, emailVerified, role, status, deletedAt
- **OAuthIdentity**: provider, providerUserId, accessToken, refreshToken, profile(JSON)
- **RefreshToken**: tokenHash, expiresAt, revokedAt, replacedBy, userAgent, ipAddress
- **EmailVerificationToken**: token, expiresAt
- **PasswordResetToken**: token, expiresAt, usedAt

### Content Domain
- **Channel**: handle(@30), displayName(@50), subscriberCount, videoCount, totalViews, links(JSON), deletedAt
- **Video**: title(@100), tags[], categoryId, visibility, processingStatus, uploadId, hlsPlaylistUrl, viewCount(BigInt), engagementScore, trendingScore, hotScore, deletedAt
- **LiveStream**: title(@100), streamKey, status, currentViewers, peakViewers, chatEnabled, dvrEnabled, saveVod, vodVideoId, deletedAt
- **LiveChat**: content(@500), type, amount, isDeleted
- **Category**: name, slug, sortOrder

### Personalization Domain
- **Subscription**: subscriberId, channelId, notificationLevel
- **WatchHistory**: watchedSeconds, videoDuration, completed, watchCount
- **UserInterest**: interestType(enum), interestId, score(0-1), viewCount, watchTime
- **VideoStats**: views24h, likes24h, views7d, views30d, avgWatchPercent

### Engagement Domain
- **Comment**: content, likeCount, replyCount, status, isPinned, isHearted, isEdited, deletedAt
- **VideoReaction**: type(LIKE/DISLIKE)
- **CommentReaction**: type(LIKE/DISLIKE)
- **Playlist**: title(@150), visibility, isSystem, systemType, videoCount
- **PlaylistVideo**: position

### Admin Domain
- **Notification**: type, title, message, actorId, videoId, channelId, commentId, liveStreamId, isRead
- **NotificationSettings**: newVideos, liveStreams, comments, replies, likes, subscribers, mentions, emailEnabled, pushEnabled
- **AuditLog**: actorId, action, resource, resourceId, reason, metadata(JSON), targetUserId
- **Report**: videoId, commentId, reportedUserId, liveStreamId, reason, status, reviewedBy, reviewNote

## Key Enums

| Enum | Values |
|------|--------|
| UserRole | USER, ADMIN |
| UserStatus | ACTIVE, SUSPENDED, BANNED |
| VideoVisibility | PUBLIC, UNLISTED, PRIVATE, SCHEDULED |
| ProcessingStatus | PENDING, UPLOADING, PROCESSING, READY, FAILED |
| ReactionType | LIKE, DISLIKE |
| CommentStatus | VISIBLE, HIDDEN, HELD, REMOVED |
| NotificationType | NEW_VIDEO, NEW_SUBSCRIBER, VIDEO_LIKE, COMMENT, COMMENT_REPLY, COMMENT_LIKE, MENTION, LIVE_STARTED, LIVE_SCHEDULED, SYSTEM |
| LiveStreamStatus | SCHEDULED, WAITING, LIVE, ENDED, CANCELLED |
| InterestType | CATEGORY, TAG, CHANNEL |
| ReportReason | SPAM, HARASSMENT, HATE_SPEECH, VIOLENCE, SEXUAL_CONTENT, MISINFORMATION, COPYRIGHT, IMPERSONATION, OTHER |
| ReportStatus | PENDING, UNDER_REVIEW, RESOLVED, DISMISSED |

## Key Design Decisions

1. **Denormalized Counters**: viewCount, likeCount, subscriberCount - avoid COUNT(*)
2. **Pre-computed Scores**: engagementScore, trendingScore, hotScore - updated by background jobs
3. **Denormalized Channel Info on Video**: channelHandle, channelName, channelAvatarUrl - avoid joins
4. **Soft Deletes**: User, Channel, Video, Comment, LiveStream have deletedAt
5. **cuid() for IDs**: URL-safe, sortable, no UUID overhead
6. **BigInt for Views**: viewCount, totalViews can handle billions

## Feed Query Indexes

| Feed | Index Pattern |
|------|---------------|
| Latest | [visibility, publishedAt DESC] |
| Trending | [visibility, trendingScore DESC] |
| Hot | [visibility, hotScore DESC] |
| Category | [categoryId, visibility, publishedAt DESC] |
| Channel | [channelId, visibility, publishedAt DESC] |
| Subscriptions | [subscriberId, subscribedAt DESC] |
| Continue Watching | [userId, lastWatchedAt DESC] |

## Post-Migration SQL (Manual)

```sql
-- GIN indexes for array searches (Prisma doesn't support)
CREATE INDEX IF NOT EXISTS idx_videos_tags ON videos USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_live_streams_tags ON live_streams USING GIN(tags);
```

## Common Queries Reference

```typescript
// Get trending videos
prisma.video.findMany({
  where: { visibility: 'PUBLIC', deletedAt: null },
  orderBy: { trendingScore: 'desc' },
  take: 20
})

// Get subscription feed
prisma.video.findMany({
  where: {
    channelId: { in: subscribedChannelIds },
    visibility: 'PUBLIC',
    deletedAt: null
  },
  orderBy: { publishedAt: 'desc' }
})

// Get continue watching
prisma.watchHistory.findMany({
  where: { userId, completed: false },
  orderBy: { lastWatchedAt: 'desc' },
  include: { video: true }
})

// Get live streams
prisma.liveStream.findMany({
  where: { status: 'LIVE', visibility: 'PUBLIC', deletedAt: null },
  orderBy: { currentViewers: 'desc' }
})
```
