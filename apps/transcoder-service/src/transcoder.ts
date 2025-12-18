import ffmpeg from "fluent-ffmpeg";
import fs from "fs-extra";
import path from "path";

export interface TranscodeOptions {
  inputPath: string;
  outputDir: string;
  resolutions?: ("360p" | "480p" | "720p" | "1080p")[];
  onProgress?: (progress: number) => void;
}

export const transcodeVideo = (options: TranscodeOptions): Promise<void> => {
  return new Promise((resolve, reject) => {
    const { inputPath, outputDir, onProgress } = options;
    const resolutions = options.resolutions || ["360p", "480p", "720p", "1080p"];

    // Ensure output directory exists
    fs.ensureDirSync(outputDir);

    console.log(`Starting transcoding for ${inputPath} to ${outputDir}`);

    let command = ffmpeg(inputPath);

    // Common HLS options
    // We want to create a master playlist and variant playlists
    
    // 360p
    if (resolutions.includes("360p")) {
      command
        .output(path.join(outputDir, "360p.m3u8"))
        .videoCodec("libx264")
        .size("640x360")
        .audioCodec("aac")
        .audioBitrate("96k")
        .videoBitrate("800k")
        .outputOptions([
          "-hls_time 10",
          "-hls_list_size 0",
          "-hls_segment_filename", path.join(outputDir, "360p_%03d.ts")
        ]);
    }

    // 480p
    if (resolutions.includes("480p")) {
      command
        .output(path.join(outputDir, "480p.m3u8"))
        .videoCodec("libx264")
        .size("854x480")
        .audioCodec("aac")
        .audioBitrate("128k")
        .videoBitrate("1400k")
        .outputOptions([
          "-hls_time 10",
          "-hls_list_size 0",
          "-hls_segment_filename", path.join(outputDir, "480p_%03d.ts")
        ]);
    }

    // 720p
    if (resolutions.includes("720p")) {
      command
        .output(path.join(outputDir, "720p.m3u8"))
        .videoCodec("libx264")
        .size("1280x720")
        .audioCodec("aac")
        .audioBitrate("128k")
        .videoBitrate("2800k")
        .outputOptions([
          "-hls_time 10",
          "-hls_list_size 0",
          "-hls_segment_filename", path.join(outputDir, "720p_%03d.ts")
        ]);
    }

    // 1080p
    if (resolutions.includes("1080p")) {
      command
        .output(path.join(outputDir, "1080p.m3u8"))
        .videoCodec("libx264")
        .size("1920x1080")
        .audioCodec("aac")
        .audioBitrate("192k")
        .videoBitrate("5000k")
        .outputOptions([
          "-hls_time 10",
          "-hls_list_size 0",
          "-hls_segment_filename", path.join(outputDir, "1080p_%03d.ts")
        ]);
    }

    command
      .on("start", (commandLine) => {
        console.log("Spawned Ffmpeg with command: " + commandLine);
      })
      .on("progress", (progress) => {
        if (onProgress && progress.percent) {
          onProgress(progress.percent);
        }
      })
      .on("error", (err, stdout, stderr) => {
        console.error("Transcoding failed:", err.message);
        console.error("ffmpeg stderr:", stderr);
        reject(err);
      })
      .on("end", () => {
        console.log("Transcoding finished!");
        createMasterPlaylist(outputDir, resolutions);
        resolve();
      })
      .run();
  });
};

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  format: string;
}

export const getVideoMetadata = (filePath: string): Promise<VideoMetadata> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const stream = metadata.streams.find(s => s.codec_type === 'video');
      resolve({
        duration: metadata.format.duration || 0,
        width: stream?.width || 0,
        height: stream?.height || 0,
        format: metadata.format.format_name || 'unknown',
      });
    });
  });
};

export const generateThumbnails = (inputPath: string, outputDir: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    fs.ensureDirSync(outputDir);
    
    const filenames: string[] = [];
    
    ffmpeg(inputPath)
      .on('filenames', (generated: string[]) => {
        filenames.push(...generated);
      })
      .on('end', () => {
        resolve(filenames);
      })
      .on('error', (err) => {
        reject(err);
      })
      .screenshots({
        count: 5,
        folder: outputDir,
        filename: 'thumbnail-%i.png',
        size: '1280x720'
      });
  });
};

const createMasterPlaylist = (outputDir: string, resolutions: string[]) => {
  let content = "#EXTM3U\n#EXT-X-VERSION:3\n";

  if (resolutions.includes("360p")) {
    content += '#EXT-X-STREAM-INF:BANDWIDTH=896000,RESOLUTION=640x360\n360p.m3u8\n';
  }
  if (resolutions.includes("480p")) {
    content += '#EXT-X-STREAM-INF:BANDWIDTH=1528000,RESOLUTION=854x480\n480p.m3u8\n';
  }
  if (resolutions.includes("720p")) {
    content += '#EXT-X-STREAM-INF:BANDWIDTH=2928000,RESOLUTION=1280x720\n720p.m3u8\n';
  }
  if (resolutions.includes("1080p")) {
    content += '#EXT-X-STREAM-INF:BANDWIDTH=5192000,RESOLUTION=1920x1080\n1080p.m3u8\n';
  }

  fs.writeFileSync(path.join(outputDir, "master.m3u8"), content);
};
