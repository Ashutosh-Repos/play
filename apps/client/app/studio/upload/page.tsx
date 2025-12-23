"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useVideoUpload } from "@/hooks/use-video-upload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { IconUpload, IconVideo, IconCheck, IconX, IconLoader2, IconWand } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";

export default function UploadPage() {
  const { uploadState, progress, processingStage, thumbnails, uploadError, startUpload, resetUpload, videoId } = useVideoUpload();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0 && acceptedFiles[0]) {
      startUpload(acceptedFiles[0]);
    }
  }, [startUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'video/x-matroska': ['.mkv'],
      'video/webm': ['.webm']
    },
    maxFiles: 1,
    disabled: uploadState !== "idle"
  });

  if (uploadState === "completed" && videoId) {
    return (
      <div className="flex bg-background h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="max-w-md w-full border-green-500/20 bg-green-500/5">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
              <IconCheck className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-green-500">Upload Complete!</h2>
            <p className="text-muted-foreground">
              Your video has been processed and is ready.
            </p>
            
            {/* Thumbnail Preview Grid */}
            {thumbnails.length > 0 && (
               <div className="grid grid-cols-3 gap-2 mt-4">
                  {thumbnails.slice(0, 3).map((t, i) => (
                    t && (
                    <div key={i} className="relative aspect-video rounded overflow-hidden border border-border">
                        <Image src={t} alt="Thumbnail" fill className="object-cover" />
                    </div>
                    )
                  ))}
               </div>
            )}

            <div className="flex flex-col gap-2 pt-4">
              <Button asChild className="w-full">
                 <Link href={`/studio/video/${videoId}`}>Edit Video Details</Link>
              </Button>
              <Button variant="outline" onClick={resetUpload} className="w-full">
                Upload Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex bg-background h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="max-w-xl w-full">
        <CardContent className="pt-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Upload Video</h1>
            <p className="text-muted-foreground">
              Drag and drop video files to upload
            </p>
          </div>

          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer min-h-[300px] flex flex-col items-center justify-center gap-4",
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
              uploadState !== "idle" && "pointer-events-none opacity-50 border-transparent"
            )}
          >
            <input {...getInputProps()} />
            
            {uploadState === "idle" ? (
              <>
                <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center">
                  <IconUpload className="w-10 h-10 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-lg">Select files to upload</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or drag and drop video files
                  </p>
                </div>
                <Button className="mt-4">Select Files</Button>
                <p className="text-xs text-muted-foreground mt-4">
                  MP4, MOV, MKV, WEBM up to 2GB
                </p>
              </>
            ) : (
              <div className="w-full space-y-6">
                 {/* Main Icon */}
                 <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                   {uploadState === 'processing' ? <IconWand className="w-10 h-10 text-primary" /> : <IconVideo className="w-10 h-10 text-primary" />}
                </div>

                {/* Progress Info */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="flex items-center gap-2">
                        {uploadState === "getting_url" && "Preparing..."}
                        {uploadState === "uploading" && "Uploading..."}
                        {uploadState === "processing" && (
                            <>
                               Processing...
                               <span className="text-muted-foreground font-normal ml-2 text-xs">({processingStage})</span>
                            </>
                        )}
                        {uploadState === "error" && "Upload Failed"}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className={cn("h-2", uploadState === "error" && "bg-red-100 [&>div]:bg-red-500")} />
                </div>

                {/* Processing Thumbnails Visualization */}
                {uploadState === "processing" && thumbnails.length > 0 && (
                     <div className="space-y-2">
                        <p className="text-xs text-muted-foreground text-left">Generated Thumbnails:</p>
                        <div className="flex gap-2 overflow-hidden justify-center">
                            {thumbnails.map((t, i) => (
                                t && (
                                <div key={i} className="relative w-20 h-12 bg-black/20 rounded overflow-hidden border border-border animate-in fade-in zoom-in duration-500">
                                    <Image src={t} alt="Generating..." fill className="object-cover" />
                                </div>
                                )
                            ))}
                        </div>
                     </div>
                )}
                
                {/* Status Messages */}
                {uploadState === "error" && (
                     <div className="flex items-center gap-2 text-destructive justify-center bg-destructive/10 p-3 rounded-md">
                        <IconX className="w-4 h-4" />
                        <span className="text-sm">{uploadError}</span>
                     </div>
                )}
                 {uploadState === "processing" && thumbnails.length === 0 && (
                    <div className="flex items-center justify-center gap-2 text-primary">
                        <IconLoader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Analyzing video logic in cloud...</span>
                    </div>
                )}
              </div>
            )}
          </div>
          
           {uploadState === "error" && (
              <div className="mt-6 text-center">
                 <Button variant="outline" onClick={resetUpload}>Try Again</Button>
              </div>
           )}

        </CardContent>
      </Card>
    </div>
  );
}
