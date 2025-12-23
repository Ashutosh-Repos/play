"use client";

import React from "react";
import HlsVideo from "hls-video-element/react";
import MediaThemeSutro from "player.style/sutro/react";

interface PlayerContentProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
}

export default function PlayerContent({ src, poster, autoPlay = true }: PlayerContentProps) {
  return (
    <MediaThemeSutro style={{ width: "100%", height: "100%" }}>
      <HlsVideo
        slot="media"
        src={src}
        poster={poster}
        playsInline
        crossOrigin="anonymous"
        autoplay={autoPlay}
      />
    </MediaThemeSutro>
  );
}
