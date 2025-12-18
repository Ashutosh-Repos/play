import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
// Ensure we mock the exact path used in controller
import { prisma } from '@repo/database/client';

// Mock Prisma
vi.mock('@repo/database/client', () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn()
    }
  },
}));

// Mock RabbitMQ/Socket (if imported by controllers)
// Since we only test routes/controllers, we might not need to mock consumers unless they are started in the same file.
// We'll see if `index.ts` or routes import them.

import { getNotifications, markAsRead, markAllAsRead } from './controllers/notification';

const app = express();
app.use(express.json());
app.get('/notifications', getNotifications);
app.patch('/notifications/:id/read', markAsRead);
app.patch('/notifications/read-all', markAllAsRead);

describe('Notification Service API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /notifications', () => {
        it('should return list of notifications', async () => {
            (prisma.notification.findMany as any).mockResolvedValue([
                { id: 'n1', title: 'New Sub', isRead: false }
            ]);
            (prisma.notification.count as any).mockResolvedValue(1);

            const res = await request(app)
                .get('/notifications')
                .set('x-user-id', 'u1');

            expect(res.status).toBe(200);
            expect(res.body.notifications).toHaveLength(1);
            expect(res.body.unreadCount).toBe(1);
        });
    });

    describe('PATCH /notifications/:id/read', () => {
        it('should mark notification as read', async () => {
            (prisma.notification.update as any).mockResolvedValue({ id: 'n1', isRead: true });

            const res = await request(app)
                .patch('/notifications/n1/read')
                .set('x-user-id', 'u1');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
