import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { prisma } from '@repo/database';
import { redis } from './lib/redis';

// Mock Prisma
vi.mock('@repo/database', () => ({
  prisma: {
    video: {
      findMany: vi.fn(),
    },
    subscription: {
        findMany: vi.fn()
    },
    watchHistory: {
        findMany: vi.fn()
    }
  },
}));

// Mock Redis
vi.mock('./lib/redis', () => ({
  redis: {
    zrevrange: vi.fn(),
  }
}));

// Mock @repo/common internalAuth middleware
vi.mock('@repo/common', () => ({
  internalAuth: () => (req: any, res: any, next: any) => {
    const userId = req.headers['x-user-id'];
    if (userId) {
      req.user = { sub: userId, role: 'USER' };
    }
    next();
  }
}));

import { getTrendingFeed, getSubscriptionFeed, getHistoryFeed } from './controllers/feed';
import { internalAuth } from '@repo/common';

const app = express();
app.use(express.json());
app.get('/feed/trending', getTrendingFeed);
app.get('/feed/subscriptions', internalAuth(), getSubscriptionFeed);
app.get('/feed/history', internalAuth(), getHistoryFeed);


describe('Feed Service API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /feed/trending', () => {
        it('should return cached trending videos', async () => {
            // Mock Redis: returns list of IDs
            (redis.zrevrange as any).mockResolvedValue(['v1', 'v2']);
            
            // Mock DB: returns videos for those IDs
            (prisma.video.findMany as any).mockResolvedValue([
                { id: 'v1', title: 'Viral Video' },
                { id: 'v2', title: 'Another Video' }
            ]);

            const res = await request(app).get('/feed/trending?limit=2');
            
            expect(res.status).toBe(200);
            expect(res.body.videos).toHaveLength(2);
            expect(res.body.videos[0].id).toBe('v1');
            expect(redis.zrevrange).toHaveBeenCalled();
        });

        it('should fallback to DB if cache empty (first page)', async () => {
             (redis.zrevrange as any).mockResolvedValue([]);
             
             (prisma.video.findMany as any).mockResolvedValue([
                 { id: 'v3', title: 'Fallback Video' }
             ]);
             
             const res = await request(app).get('/feed/trending');
             expect(res.status).toBe(200);
             expect(res.body.videos).toHaveLength(1);
        });
    });

    describe('GET /feed/subscriptions', () => {
        it('should return subscription videos', async () => {
            (prisma.subscription.findMany as any).mockResolvedValue([{ channelId: 'c1' }]);
            (prisma.video.findMany as any).mockResolvedValue([{ id: 'v10', title: 'Sub Video' }]);

            const res = await request(app)
                .get('/feed/subscriptions')
                .set('x-user-id', 'u1');

            expect(res.status).toBe(200);
            expect(res.body.videos).toHaveLength(1);
        });
    });
});
