---
description: Post-migration steps for database setup
---

# Database Post-Migration Steps

After running `pnpm db:push` or `pnpm db:migrate`, execute these manual SQL commands:

## 1. GIN Index for Video Tags (Array Search)

```sql
-- Required for fast tag-based video searches
-- Prisma doesn't support GIN indexes natively
CREATE INDEX IF NOT EXISTS idx_videos_tags ON videos USING GIN(tags);

-- Also for live stream tags
CREATE INDEX IF NOT EXISTS idx_live_streams_tags ON live_streams USING GIN(tags);
```

## 2. Verify Indexes

```sql
-- Check all indexes on videos table
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'videos';

-- Check live_streams indexes
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'live_streams';
```

## Why This Matters

- Without GIN index: Tag searches scan entire table (slow)
- With GIN index: Tag searches use inverted index (fast)

## When to Run

- After every `pnpm db:push`
- After every `pnpm db:migrate`
- In production deployment scripts
