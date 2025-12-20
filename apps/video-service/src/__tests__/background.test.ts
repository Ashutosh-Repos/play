
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies BEFORE importing the module under test
// 1. Mock Config
vi.mock('../config.js', () => ({
  config: {
    upload: {
      staleUploadThreshold: 2 * 60 * 60 * 1000,
    },
  },
}));

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      video: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      outboxEvent: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    }
  }
});

vi.mock('@repo/database', () => ({
  prisma: mockPrisma,
}));

// 3. Mock Storage
vi.mock('../lib/storage.js', () => ({
  deleteObjectsWithPrefix: vi.fn(),
}));

// 4. Mock Publisher
// We need to mock the dynamic import or the module itself
vi.mock('../events/publisher.js', () => ({
  emitAndMarkProcessed: vi.fn(),
  emitVideoUploaded: vi.fn(),
}));

// Import the module under test
import {
  cleanupStaleUploads,
  processOutbox,
  retryFailedTranscodes,
  hardDeleteOldVideos
} from '../jobs/background.js';
import { deleteObjectsWithPrefix } from '../lib/storage.js';
import { emitVideoUploaded } from '../events/publisher.js';

describe('Background Jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanupStaleUploads', () => {
    it('should find stale uploads and mark them as FAILED', async () => {
      // Setup
      const staleVideos = [{ id: 'video-1' }, { id: 'video-2' }];
      mockPrisma.video.findMany.mockResolvedValue(staleVideos);
      mockPrisma.video.updateMany.mockResolvedValue({ count: 2 });

      // Execute
      const count = await cleanupStaleUploads();

      // Verify
      expect(count).toBe(2);
      expect(mockPrisma.video.findMany).toHaveBeenCalled();
      expect(mockPrisma.video.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['video-1', 'video-2'] },
          processingStatus: 'UPLOADING',
        },
        data: expect.objectContaining({
          processingStatus: 'FAILED',
        }),
      });
      expect(deleteObjectsWithPrefix).toHaveBeenCalledTimes(2); // One per video
    });

    it('should do nothing if no stale uploads found', async () => {
      mockPrisma.video.findMany.mockResolvedValue([]);
      const count = await cleanupStaleUploads();
      expect(count).toBe(0);
      expect(mockPrisma.video.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('retryFailedTranscodes', () => {
    it('should retry failed videos and increment attempts', async () => {
      const failedVideos = [
        { 
          id: 'video-fail-1', 
          channel: { userId: 'user-1' }, 
          originalFileName: 'test.mp4', 
          originalFileSize: 1000, 
          uploadAttempts: 1 
        }
      ];
      mockPrisma.video.findMany.mockResolvedValue(failedVideos);
      mockPrisma.video.update.mockResolvedValue({}); // update returns the updated object

      const count = await retryFailedTranscodes();

      expect(count).toBe(1);
      
      // Should find failed videos
      expect(mockPrisma.video.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          processingStatus: 'FAILED',
          uploadAttempts: { lt: 3 },
        })
      }));

      // Should increment attempts
      expect(mockPrisma.video.update).toHaveBeenCalledWith({
        where: { id: 'video-fail-1' },
        data: {
          uploadAttempts: { increment: 1 },
          processingStatus: 'PROCESSING',
          processingError: null,
        },
      });

      // Should re-emit event
      expect(emitVideoUploaded).toHaveBeenCalledWith(
        'video-fail-1',
        'user-1',
        'test.mp4',
        1000,
        'video/mp4'
      );
    });
  });

  describe('hardDeleteOldVideos', () => {
    it('should permanently delete soft-deleted videos older than 30 days', async () => {
      const oldVideos = [{ id: 'video-old' }];
      mockPrisma.video.findMany.mockResolvedValue(oldVideos);
      
      const count = await hardDeleteOldVideos();
      
      expect(count).toBe(1);
      expect(deleteObjectsWithPrefix).toHaveBeenCalledWith('uploads/video-old/');
      expect(deleteObjectsWithPrefix).toHaveBeenCalledWith('processed/video-old/');
      expect(mockPrisma.video.delete).toHaveBeenCalledWith({
        where: { id: 'video-old' },
      });
    });
  });
});
