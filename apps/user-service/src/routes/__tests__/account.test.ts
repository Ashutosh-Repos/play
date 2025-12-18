import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../index.js';
import { prisma } from '@repo/database';
import bcrypt from 'bcrypt';

// Mock dependencies

vi.mock('../events/publisher', () => ({
  connectRabbitMQ: vi.fn(),
  startConsumer: vi.fn(),
  emitUserDeleted: vi.fn(),
  emitUserUpdated: vi.fn(),
}));

// Mock Auth Middleware
vi.mock('@repo/common', async () => {
  const actual = await vi.importActual('@repo/common');
  return {
    ...actual,
    authMiddleware: () => (req: any, res: any, next: any) => {
      req.user = { sub: 'user-123', role: 'USER', email: 'test@example.com' };
      next();
    },
  };
});

// Mock crypto for token generation
vi.mock('crypto', () => ({
  randomBytes: () => ({ toString: () => 'mock-token' }),
}));

describe('Account Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/account/email', () => {
    it('should request email change', async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce({
          id: 'user-123',
          email: 'old@example.com',
          passwordHash: null,
        })
        .mockResolvedValueOnce(null); // Check email taken
      (prisma.emailVerificationToken.create as any).mockResolvedValue({ token: 'mock-token' });

      const res = await request(app)
        .post('/api/v1/account/email')
        .send({ newEmail: 'new@example.com' });

      expect(res.status).toBe(200);
      expect(prisma.emailVerificationToken.create).toHaveBeenCalled();
    });

    it('should fail if email invalid', async () => {
      const res = await request(app)
        .post('/api/v1/account/email')
        .send({ newEmail: 'invalid-email' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/v1/account/username', () => {
    it('should change username', async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce({
          id: 'user-123',
          username: 'oldname',
        })
        .mockResolvedValueOnce(null); // Username not taken
      (prisma.$transaction as any).mockResolvedValue([
        { username: 'newname' },
        { id: 'audit-1' },
      ]);

      const res = await request(app)
        .patch('/api/v1/account/username')
        .send({ username: 'newname' });

      expect(res.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should fail if rate limited', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'user-123',
        username: 'oldname',
      });
      (prisma.auditLog.findFirst as any).mockResolvedValue({
        createdAt: new Date(), // Recent change
      });

      const res = await request(app)
        .patch('/api/v1/account/username')
        .send({ username: 'newname' });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('GET /api/v1/account/export', () => {
    it('should export user data', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        identities: [],
        channel: null,
        subscriptions: [],
        notificationSettings: {},
        watchHistory: [],
        comments: [],
        videoReactions: [],
      });

      const res = await request(app).get('/api/v1/account/export');

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/json');
      expect(res.header['content-disposition']).toContain('attachment');
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
    });
  });
});
