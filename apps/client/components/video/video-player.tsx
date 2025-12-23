"use client";

import React from "react";
import dynamic from "next/dynamic";

const PlayerContent = dynamic<VideoPlayerProps>(
  () => import("./player-content"),
  { ssr: false }
);

interface VideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
}

export function VideoPlayer(props: VideoPlayerProps) {
  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-xl">
      <PlayerContent {...props} />
    </div>
  );
}
