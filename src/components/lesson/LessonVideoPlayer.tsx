"use client";

import { useEffect, useRef, useState } from "react";

import { YouTubePlayer } from "./YouTubePlayer";

type Props = {
  videoUrl: string;
};

export function LessonVideoPlayer({ videoUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isYoutube, setIsYoutube] = useState(false);

  useEffect(() => {
    const u = videoUrl;
    setIsYoutube(u.includes("youtube.com") || u.includes("youtu.be"));
  }, [videoUrl]);

  if (isYoutube) {
    return <YouTubePlayer videoUrl={videoUrl} />;
  }

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      controls
      className="h-full w-full"
      preload="metadata"
    />
  );
}
