import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transcodeVideo, getVideoMetadata, generateThumbnails } from '../transcoder.js';
import path from 'path';

// Mock fluent-ffmpeg
const listeners: Record<string, Function> = {};

const mockFfmpegInstance = {
  output: vi.fn().mockReturnThis(),
  videoCodec: vi.fn().mockReturnThis(),
  size: vi.fn().mockReturnThis(),
  audioCodec: vi.fn().mockReturnThis(),
  audioBitrate: vi.fn().mockReturnThis(),
  videoBitrate: vi.fn().mockReturnThis(),
  outputOptions: vi.fn().mockReturnThis(),
  on: vi.fn().mockImplementation(function (this: any, event, callback) {
    listeners[event] = callback;
    return this;
  }),
  run: vi.fn().mockImplementation(() => {
    // Simulate progress events if listener exists
    const progressListener = listeners['progress'];
    if (progressListener) {
      setTimeout(() => progressListener({ percent: 10 }), 2);
      setTimeout(() => progressListener({ percent: 50 }), 5);
      setTimeout(() => progressListener({ percent: 90 }), 7);
    }

    // Simulate end successfully if 'end' listener exists
    const endListener = listeners['end'];
    if (endListener) {
      setTimeout(() => endListener(), 10);
    }
  }),
  screenshots: vi.fn().mockImplementation((options) => {
    if (listeners['filenames']) {
        listeners['filenames'](['thumbnail-1.png', 'thumbnail-2.png']);
    }
    const endListener = listeners['end'];
    if (endListener) {
       setTimeout(() => endListener(), 10);
    }
    return this;
  })
};

vi.mock('fluent-ffmpeg', () => {
  const ffmpegFn = vi.fn(() => mockFfmpegInstance);
  (ffmpegFn as any).ffprobe = vi.fn((file, cb) => {
    cb(null, {
      format: { duration: 120, format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },
      streams: [{ codec_type: 'video', width: 1920, height: 1080 }]
    });
  });
  return {
    default: ffmpegFn,
  };
});

// Mock fs-extra
vi.mock('fs-extra', () => ({
  default: {
    ensureDirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

describe('Transcoder Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear listeners
    for (const key in listeners) delete listeners[key];
  });

  it('should construct ffmpeg command with all resolutions', async () => {
    await transcodeVideo({
      inputPath: 'input.mp4',
      outputDir: '/out',
      sourceHeight: 1080,
    });

    expect(mockFfmpegInstance.output).toHaveBeenCalledTimes(4); // 360, 480, 720, 1080
    expect(mockFfmpegInstance.run).toHaveBeenCalled();
    
    // Check specific resolutions
    expect(mockFfmpegInstance.size).toHaveBeenCalledWith('1920x1080');
    expect(mockFfmpegInstance.size).toHaveBeenCalledWith('1280x720');
  });

  it('should create master playlist', async () => {
    const fs = await import('fs-extra');
    
    await transcodeVideo({
      inputPath: 'input.mp4',
      outputDir: '/out',
      sourceHeight: 1080,
    });

    expect(fs.default.writeFileSync).toHaveBeenCalledWith(
      '/out/master.m3u8',
      expect.stringContaining('#EXTM3U')
    );
    expect(fs.default.writeFileSync).toHaveBeenCalledWith(
      '/out/master.m3u8',
      expect.stringContaining('1080p.m3u8')
    );
  });

  it('should report transcoding progress', async () => {
    const onProgress = vi.fn();
    
    await transcodeVideo({
      inputPath: 'input.mp4',
      outputDir: '/out',
      sourceHeight: 1080,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith(10);
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(onProgress).toHaveBeenCalledWith(90);
  });

  it('should extract video metadata', async () => {
    const metadata = await getVideoMetadata('input.mp4');
    
    expect(metadata).toEqual({
      duration: 120,
      width: 1920,
      height: 1080,
      format: 'mov,mp4,m4a,3gp,3g2,mj2'
    });
  });

  it('should generate thumbnails', async () => {
    const thumbnails = await generateThumbnails('input.mp4', '/out/thumbnails');
    
    expect(mockFfmpegInstance.screenshots).toHaveBeenCalledWith(expect.objectContaining({
      count: 5,
      folder: '/out/thumbnails',
      size: '1280x720'
    }));
    expect(thumbnails).toEqual(['thumbnail-1.png', 'thumbnail-2.png']);
  });
});
