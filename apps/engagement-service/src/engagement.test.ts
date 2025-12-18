import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { prisma } from '@repo/database';

// Mock Prisma
vi.mock('@repo/database', () => ({
  prisma: {
    comment: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    video: {
      update: vi.fn()
    },
    videoReaction: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
    }
  },
}));

// Mock Publisher (to avoid RabbitMQ connection)
vi.mock('../events/publisher', () => ({
  emitCommentCreated: vi.fn(),
  emitVideoLiked: vi.fn()
}));

import { createComment, listComments } from './controllers/comment';
import { toggleReaction } from './controllers/reaction';

const app = express();
app.use(express.json());
// Fix routes to match controller expectations (params)
app.post('/videos/:id/comments', createComment);
app.get('/videos/:id/comments', listComments);
app.post('/videos/:id/like', toggleReaction);

describe('Engagement Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /comments', () => {
    it('should create a comment', async () => {
        // Mock DB Response
        (prisma.comment.create as any).mockResolvedValue({
            id: 'c1',
            content: 'Test Comment',
            userId: 'u1',
            videoId: 'v1'
        });

        const res = await request(app)
            .post('/videos/v1/comments')
            .set('x-user-id', 'u1')
            .send({
                content: 'Test Comment'
            });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe('c1');
        expect(prisma.comment.create).toHaveBeenCalled();
    });

    it('should return 401 if no user header', async () => {
        const res = await request(app)
            .post('/videos/v1/comments')
            .send({ content: 'test' });
        expect(res.status).toBe(401);
    });
  });
  
  describe('POST /videos/:id/like', () => {
      it('should toggle like', async () => {
          // Mock Existing: None
          (prisma.videoReaction.findUnique as any).mockResolvedValue(null);
          
          const res = await request(app)
             .post('/videos/v1/like')
             .set('x-user-id', 'u1')
             .send({ type: 'LIKE' });
             
           expect(res.status).toBe(200);
           expect(res.body.status).toBe('created');
      });
  });
});
