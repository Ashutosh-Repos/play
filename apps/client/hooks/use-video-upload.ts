"use client";

import { useState, useRef } from "react";
import { initiateVideoUpload, completeVideoUpload } from "@/app/actions/video";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export type UploadState = 
  | "idle" 
  | "getting_url" 
  | "uploading" 
  | "processing" 
  | "completed" 
  | "error";

interface UseVideoUploadReturn {
  uploadState: UploadState;
  progress: number; // 0-100 for current stage
  processingStage: string; // e.g., "Transcoding 720p", "Generating Thumbnails"
  thumbnails: string[]; // Start showing these as they arrive
  uploadError: string | null;
  startUpload: (file: File) => Promise<void>;
  resetUpload: () => void;
  videoId: string | null;
}

export function useVideoUpload(): UseVideoUploadReturn {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<string>("Initializing...");
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const router = useRouter();
  
  // Ref to keep track of socket so we can close it
  const socketRef = useRef<WebSocket | null>(null);

  const resetUpload = () => {
    setUploadState("idle");
    setProgress(0);
    setProcessingStage("");
    setThumbnails([]);
    setUploadError(null);
    setVideoId(null);
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  const connectWebSocket = (wsUrl: string, vId: string) => {
    if (!wsUrl || typeof wsUrl !== 'string') return;

    if (socketRef.current) {
      socketRef.current.close();
    }

    console.log("[WS] Connecting to:", wsUrl);
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("[WS] Connected");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[WS] Event:", data);

        // Handle Server Events
        switch (data.type) {
          case "progress":
            // { type: "progress", status: "processing", progress: 50, stage: "720p" }
            setUploadState("processing");
            if (typeof data.progress === 'number') {
              setProgress(data.progress);
            }
            if (data.stage) {
              setProcessingStage(data.stage);
            }
            break;

          case "thumbnails":
             // { type: "thumbnails", thumbnails: [...] }
             if (Array.isArray(data.thumbnails)) {
               setThumbnails(data.thumbnails);
               // If we get thumbnails, it means we are deep in processing
               setUploadState("processing");
             }
             break;

          case "state":
            // { type: "state", status: "ready" | "failed", ... }
            if (data.status === "ready" || data.status === "READY") {
              setUploadState("completed");
              setProgress(100);
              setProcessingStage("Checks complete");
              socket.close();
              toast.success("Video processing complete!");
              // Delay redirect slightly so user sees 100%
              setTimeout(() => {
                router.push(`/studio/video/${vId}`);
              }, 1500);
            } else if (data.status === "failed" || data.status === "FAILED") {
              setUploadState("error");
              setUploadError(data.error || "Processing failed");
              socket.close();
            } else if (data.status === "processing") {
               // Initial state dump
               setUploadState("processing");
               if (data.progress) setProgress(data.progress);
            }
            break;
        }
      } catch (e) {
        console.error("[WS] Parse error", e);
      }
    };

    socket.onerror = (e) => {
      console.error("[WS] Error", e);
    };
  };

  const startUpload = async (file: File) => {
    try {
      // Clean up previous
      resetUpload();
      
      setUploadState("getting_url");
      setUploadError(null);
      setProgress(0);

      // 1. Initiate Upload
      const initResult = await initiateVideoUpload(file.name);
      
      if (!initResult.success || !initResult.data) {
        throw new Error(initResult.error?.message || "Failed to initiate upload");
      }

      const { uploadUrl, videoId: newVideoId, wsUrl } = initResult.data;
      setVideoId(newVideoId);
      setUploadState("uploading");

      // 2. Perform Upload via XHR
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4"); 

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload aborted"));

        xhr.send(file);
      });

      // 3. Confirm Completion
      // Reset progress for "Processing" phase
      setProgress(0); 
      setUploadState("processing");
      setProcessingStage("Verifying upload...");
      
      await completeVideoUpload(newVideoId);
      
      // 4. Connect to WS for processing updates
      if (wsUrl) {
          connectWebSocket(wsUrl, newVideoId);
      } else {
          // Fallback
          toast.success("Upload complete! Processing in background.");
          setTimeout(() => {
              router.push(`/studio/video/${newVideoId}`);
          }, 2000);
      }

    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadState("error");
      setUploadError(error.message || "An unexpected error occurred");
      toast.error("Upload failed. Please try again.");
    }
  };

  return {
    uploadState,
    progress,
    processingStage,
    thumbnails,
    uploadError,
    startUpload,
    resetUpload,
    videoId,
  };
}
