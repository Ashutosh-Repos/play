import ffmpeg from "fluent-ffmpeg";
import fs from "fs-extra";
import path from "path";

// Resolution definitions with dimensions and bitrates
export const RESOLUTION_CONFIG = {
  "4k": { width: 3840, height: 2160, videoBitrate: "15000k", audioBitrate: "256k", minHeight: 2160 },
  "2k": { width: 2560, height: 1440, videoBitrate: "10000k", audioBitrate: "192k", minHeight: 1440 },
  "1080p": { width: 1920, height: 1080, videoBitrate: "5000k", audioBitrate: "192k", minHeight: 1080 },
  "720p": { width: 1280, height: 720, videoBitrate: "2800k", audioBitrate: "128k", minHeight: 720 },
  "480p": { width: 854, height: 480, videoBitrate: "1400k", audioBitrate: "128k", minHeight: 480 },
  "360p": { width: 640, height: 360, videoBitrate: "800k", audioBitrate: "96k", minHeight: 360 },
} as const;

export type Resolution = keyof typeof RESOLUTION_CONFIG;

// All resolutions in order from highest to lowest
const ALL_RESOLUTIONS: Resolution[] = ["4k", "2k", "1080p", "720p", "480p", "360p"];

// Minimum acceptable resolution
const MIN_RESOLUTION_HEIGHT = 360;

// FFmpeg thread limit to prevent CPU starvation
const FFMPEG_THREADS = process.env.FFMPEG_THREADS || "4";

export interface TranscodeOptions {
  inputPath: string;
  outputDir: string;
  sourceHeight: number;        // Pass source height to determine resolutions
  onProgress?: (progress: number) => void;
  timeout?: number; // Timeout in seconds
}

export interface TranscodeResult {
  resolutions: Resolution[];
  masterPlaylistPath: string;
}

/**
 * Determine which resolutions to produce based on source video height
 * Only produces resolutions <= source resolution
 */
export function getTargetResolutions(sourceHeight: number): Resolution[] {
  if (sourceHeight < MIN_RESOLUTION_HEIGHT) {
    return []; // Video too small to process
  }
  
  return ALL_RESOLUTIONS.filter(res => {
    const config = RESOLUTION_CONFIG[res];
    return sourceHeight >= config.minHeight;
  });
}

/**
 * Transcode video to HLS with adaptive resolutions based on source
 */
export const transcodeVideo = (options: TranscodeOptions): Promise<TranscodeResult> => {
  return new Promise((resolve, reject) => {
    const { inputPath, outputDir, sourceHeight, onProgress, timeout } = options;
    
    // Determine target resolutions based on source
    const resolutions = getTargetResolutions(sourceHeight);
    
    if (resolutions.length === 0) {
      reject(new Error(`Video resolution too low (height: ${sourceHeight}px). Minimum required: ${MIN_RESOLUTION_HEIGHT}px`));
      return;
    }
    
    console.log(`Source height: ${sourceHeight}px → Producing resolutions: ${resolutions.join(", ")}`);

    // Ensure output directory exists
    fs.ensureDirSync(outputDir);

    console.log(`Starting transcoding for ${inputPath} to ${outputDir}`);

    let command = ffmpeg(inputPath);

    // Apply timeout if specified
    if (timeout) {
      command.timeout(timeout); 
    }
    
    // Add each resolution as an output
    for (const res of resolutions) {
      const config = RESOLUTION_CONFIG[res];
      const size = `${config.width}x${config.height}`;
      
      command
        .output(path.join(outputDir, `${res}.m3u8`))
        .videoCodec("libx264")
        .size(size)
        .audioCodec("aac")
        .audioBitrate(config.audioBitrate)
        .videoBitrate(config.videoBitrate)
        .outputOptions([
          `-threads ${FFMPEG_THREADS}`,     // Limit threads per output
          "-preset fast",                   // Balance speed/quality
          "-profile:v main",                // Broad compatibility
          "-level 4.0",                     // Compatibility level
          "-hls_time 10",                   // 10 second segments
          "-hls_list_size 0",               // Keep all segments in playlist
          "-hls_segment_filename", path.join(outputDir, `${res}_%03d.ts`)
        ]);
    }

    // Global input options for thread limiting
    command.inputOptions([
      `-threads ${FFMPEG_THREADS}`
    ]);

    command
      .on("start", (commandLine) => {
        console.log("Spawned FFmpeg with command: " + commandLine);
      })
      .on("progress", (progress) => {
        if (onProgress && progress.percent) {
          onProgress(progress.percent);
        }
      })
      .on("error", (err, stdout, stderr) => {
        console.error("Transcoding failed:", err.message);
        if (stderr) console.error("FFmpeg stderr:", stderr);
        reject(err);
      })
      .on("end", () => {
        console.log("Transcoding finished!");
        createMasterPlaylist(outputDir, resolutions);
        resolve({
          resolutions,
          masterPlaylistPath: path.join(outputDir, "master.m3u8"),
        });
      })
      .run();
  });
};

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  format: string;
  fps: number;
}

export const getVideoMetadata = (filePath: string): Promise<VideoMetadata> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const stream = metadata.streams.find((s: any) => s.codec_type === "video");
      
      // Parse framerate (e.g., "30/1" or "29.97")
      let fps = 30;
      if (stream?.r_frame_rate) {
        const parts = stream.r_frame_rate.split("/");
        if (parts.length === 2) {
          fps = Math.round(parseInt(parts[0]!) / parseInt(parts[1]!));
        } else {
          fps = Math.round(parseFloat(stream.r_frame_rate));
        }
      }
      
      resolve({
        duration: metadata.format.duration || 0,
        width: stream?.width || 0,
        height: stream?.height || 0,
        format: metadata.format.format_name || "unknown",
        fps,
      });
    });
  });
};

/**
 * Generate thumbnail images from video
 * Size is dynamic based on source resolution
 */
export const generateThumbnails = (
  inputPath: string, 
  outputDir: string,
  sourceHeight?: number
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    fs.ensureDirSync(outputDir);
    
    // Dynamic thumbnail size based on source resolution
    // Default to 720p if source height not provided
    let thumbnailSize = "1280x720";
    if (sourceHeight) {
      if (sourceHeight >= 2160) {
        thumbnailSize = "1920x1080"; // 4K source → 1080p thumbnails
      } else if (sourceHeight >= 1440) {
        thumbnailSize = "1920x1080"; // 2K source → 1080p thumbnails
      } else if (sourceHeight >= 1080) {
        thumbnailSize = "1280x720";  // 1080p source → 720p thumbnails
      } else if (sourceHeight >= 720) {
        thumbnailSize = "1280x720";  // 720p source → 720p thumbnails
      } else if (sourceHeight >= 480) {
        thumbnailSize = "854x480";   // 480p source → 480p thumbnails
      } else {
        thumbnailSize = "640x360";   // 360p source → 360p thumbnails
      }
    }
    
    console.log(`Generating thumbnails at ${thumbnailSize} for source height ${sourceHeight || "unknown"}`);
    
    const filenames: string[] = [];
    
    ffmpeg(inputPath)
      .inputOptions([`-threads ${FFMPEG_THREADS}`])  // Limit threads
      .on("filenames", (generated: string[]) => {
        filenames.push(...generated);
      })
      .on("end", () => {
        console.log(`Generated ${filenames.length} thumbnails: ${filenames.join(", ")}`);
        resolve(filenames);
      })
      .on("error", (err) => {
        reject(err);
      })
      .screenshots({
        count: 5,
        folder: outputDir,
        filename: "thumbnail-%i.png",
        size: thumbnailSize
      });
  });
};

/**
 * Create master playlist with all available resolutions
 */
const createMasterPlaylist = (outputDir: string, resolutions: Resolution[]) => {
  let content = "#EXTM3U\n#EXT-X-VERSION:3\n";
  
  // Sort by bandwidth (lowest first for progressive enhancement)
  const sortedResolutions = [...resolutions].reverse();
  
  for (const res of sortedResolutions) {
    const config = RESOLUTION_CONFIG[res];
    // Calculate approximate bandwidth (video + audio in bits/sec)
    const videoBits = parseInt(config.videoBitrate) * 1000;
    const audioBits = parseInt(config.audioBitrate) * 1000;
    const bandwidth = videoBits + audioBits;
    
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${config.width}x${config.height}\n${res}.m3u8\n`;
  }

  fs.writeFileSync(path.join(outputDir, "master.m3u8"), content);
  console.log(`Created master playlist with resolutions: ${resolutions.join(", ")}`);
};

/**
 * Cleanup temporary working directory
 */
export const cleanupWorkDir = async (workDir: string): Promise<void> => {
  try {
    await fs.remove(workDir);
    console.log(`Cleaned up working directory: ${workDir}`);
  } catch (error) {
    console.warn(`Failed to cleanup ${workDir}:`, error);
  }
};
