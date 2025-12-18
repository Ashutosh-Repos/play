import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
// Mock library before import
vi.mock('./lib/meili', () => ({
  meili: {
    index: vi.fn().mockReturnValue({
        search: vi.fn()
    })
  },
  INDEX_VIDEOS: 'videos'
}));

// Mock RabbitMQ (consumer imported in index, not controller usually, but let's be safe)
vi.mock('./consumers/video', () => ({
    setupVideoConsumers: vi.fn()
}));

import { meili } from './lib/meili';
import { searchVideos } from './controllers/search';

const app = express();
app.use(express.json());
app.get('/search', searchVideos);

describe('Search Service API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /search', () => {
        it('should return search results', async () => {
             const mockSearch = vi.fn().mockResolvedValue({
                 hits: [{ id: 'v1', title: 'Test Video' }],
                 estimatedTotalHits: 1,
                 processingTimeMs: 10
             });
             
             (meili.index as any).mockReturnValue({ search: mockSearch });

             const res = await request(app).get('/search?q=test');

             expect(res.status).toBe(200);
             expect(res.body.hits).toHaveLength(1);
             expect(res.body.totalPages).toBe(1);
             expect(mockSearch).toHaveBeenCalledWith("test", expect.objectContaining({
                 limit: 20,
                 offset: 0,
                 filter: expect.arrayContaining(["visibility = PUBLIC"])
             }));
        });

        it('should handle pagination', async () => {
             const mockSearch = vi.fn().mockResolvedValue({
                 hits: [],
                 estimatedTotalHits: 100,
                 processingTimeMs: 10
             });
             (meili.index as any).mockReturnValue({ search: mockSearch });

             await request(app).get('/search?page=2&limit=10');

             expect(mockSearch).toHaveBeenCalledWith("", expect.objectContaining({
                 limit: 10,
                 offset: 10
             }));
        });
    });
});
