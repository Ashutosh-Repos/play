"use client";

import { useRef, useState, useTransition } from "react";
import { uploadImage } from "@/app/actions/upload";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { IconCamera, IconLoader2, IconUpload, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  type: "avatar" | "banner" | "channel-avatar" | "channel-banner";
  currentUrl?: string | null;
  fallback?: string;
  onUpload?: (url: string) => void;
  className?: string;
}

export function ImageUpload({ type, currentUrl, fallback, onUpload, className }: ImageUploadProps) {
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAvatar = type === "avatar" || type === "channel-avatar";
  const isBanner = type === "banner" || type === "channel-banner";

  async function handleFile(file: File) {
    // Validate before upload
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Use JPEG, PNG, WebP, or GIF.");
      return;
    }

    const maxSize = isBanner ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxMB = maxSize / 1024 / 1024;
      toast.error(`File too large. Maximum ${maxMB}MB.`);
      return;
    }

    // Show preview immediately
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    // Upload
    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadImage(formData, type);
      if (result.success && result.url) {
        toast.success("Image uploaded!");
        setPreview(result.url);
        onUpload?.(result.url);
      } else {
        toast.error(result.error || "Upload failed");
        setPreview(currentUrl ?? null);
      }
      URL.revokeObjectURL(previewUrl);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  if (isAvatar) {
    return (
      <div className={cn("relative group", className)}>
        <Avatar className="h-24 w-24 cursor-pointer" onClick={() => inputRef.current?.click()}>
          <AvatarImage src={preview || undefined} />
          <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
            {fallback?.charAt(0)?.toUpperCase() || "U"}
          </AvatarFallback>
          <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {isPending ? (
              <IconLoader2 className="h-6 w-6 text-white animate-spin" />
            ) : (
              <IconCamera className="h-6 w-6 text-white" />
            )}
          </div>
        </Avatar>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleChange}
          className="hidden"
        />
      </div>
    );
  }

  // Banner style
  return (
    <div
      className={cn(
        "relative w-full h-32 md:h-40 rounded-lg overflow-hidden border-2 border-dashed transition-colors cursor-pointer",
        dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50",
        className
      )}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {preview ? (
        <>
          <img src={preview} alt="Banner" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
            {isPending ? (
              <IconLoader2 className="h-8 w-8 text-white animate-spin" />
            ) : (
              <div className="text-center text-white">
                <IconCamera className="h-8 w-8 mx-auto mb-1" />
                <span className="text-sm">Change banner</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
          {isPending ? (
            <IconLoader2 className="h-8 w-8 animate-spin" />
          ) : (
            <>
              <IconUpload className="h-8 w-8 mb-2" />
              <span className="text-sm">Drop image or click to upload</span>
              <span className="text-xs mt-1">Recommended: 2560×400</span>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
