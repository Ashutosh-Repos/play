import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../index.js';
import { prisma } from '@repo/database';

// Mock dependencies
// Mock dependencies
vi.mock('../../events/publisher', () => ({
  connectRabbitMQ: vi.fn(),
  emitChannelCreated: vi.fn(),
  emitChannelUpdated: vi.fn(),
  emitChannelDeleted: vi.fn(),
  startConsumer: vi.fn(),
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

// Since index.ts calls start(), which connects to RMQ, we might need to be careful.
// But we mocked connectRabbitMQ and startConsumer, so it should be fine.
// However, start() runs on import. Ideally we should export app before start(), or prevent start() in test.
// For now, let's assume mocked connection works.

describe('Channel Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/channels/me', () => {
    it('should return my channel', async () => {
      // Setup mock
      (prisma.channel.findUnique as any).mockResolvedValue({
        id: 'channel-1',
        handle: 'mychannel',
        displayName: 'My Channel',
        userId: 'user-123',
      });

      const res = await request(app).get('/api/v1/channels/me');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.handle).toBe('mychannel');
    });

    it('should return 404 if no channel', async () => {
      (prisma.channel.findUnique as any).mockResolvedValue(null);

      const res = await request(app).get('/api/v1/channels/me');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NO_CHANNEL');
    });
  });

  describe('POST /api/v1/channels', () => {
    it('should create a channel', async () => {
      // Mock no existing channel
      (prisma.channel.findUnique as any).mockResolvedValue(null);
      // Mock creation
      (prisma.channel.create as any).mockResolvedValue({
        id: 'channel-new',
        handle: 'newchan',
        displayName: 'New Chan',
      });

      const res = await request(app)
        .post('/api/v1/channels')
        .send({ handle: 'newchan', displayName: 'New Chan' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(prisma.channel.create).toHaveBeenCalled();
    });

    it('should fail if handle taken', async () => {
      // Mock existing handle
      (prisma.channel.findUnique as any)
        .mockResolvedValueOnce(null) // Check existing user channel
        .mockResolvedValueOnce({ id: 'existing' }); // Check handle taken

      const res = await request(app)
        .post('/api/v1/channels')
        .send({ handle: 'taken', displayName: 'Taken' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('HANDLE_TAKEN');
    });
  });

  describe('GET /api/v1/channels/:handle/subscribers', () => {
    it('should return subscribers for owner', async () => {
      (prisma.channel.findUnique as any).mockResolvedValue({
        id: 'channel-1',
        userId: 'user-123', // Same as mocked auth user
      });
      (prisma.subscription.findMany as any).mockResolvedValue([
        { id: 'sub-1', subscriber: { username: 'fan1' } },
      ]);

      const res = await request(app).get('/api/v1/channels/mychannel/subscribers');

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
    });

    it('should forbid non-owner', async () => {
      (prisma.channel.findUnique as any).mockResolvedValue({
        id: 'channel-other',
        userId: 'user-other',
      });

      const res = await request(app).get('/api/v1/channels/other/subscribers');

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/channels/:handle', () => {
    it('should delete channel', async () => {
      (prisma.channel.findUnique as any).mockResolvedValue({
        id: 'channel-1',
        userId: 'user-123',
      });
      (prisma.channel.update as any).mockResolvedValue({ deletedAt: new Date() });

      const res = await request(app).delete('/api/v1/channels/mychannel');

      expect(res.status).toBe(200);
      expect(prisma.channel.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'channel-1' } })
      );
      // Verify event emitted
      const { emitChannelDeleted } = await import('../../events/publisher.js');
      expect(emitChannelDeleted).toHaveBeenCalledWith('channel-1', 'user-123');
    });
  });
});
