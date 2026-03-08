"use client";

import { useEffect, useRef } from "react";

type YTPlayerInstance = { destroy: () => void };

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          playerVars?: { start?: number; enablejsapi?: number };
        }
      ) => YTPlayerInstance;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function getYouTubeVideoId(url: string): string | null {
  try {
    if (url.includes("youtube.com/watch")) {
      const parsed = new URL(url);
      return parsed.searchParams.get("v");
    }
    if (url.includes("youtu.be/")) {
      const parsed = new URL(url);
      const path = parsed.pathname.replace(/^\//, "");
      return path.split("?")[0] || null;
    }
  } catch {}
  return null;
}

type Props = {
  videoUrl: string;
};

export function YouTubePlayer({ videoUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);

  useEffect(() => {
    const rawId = getYouTubeVideoId(videoUrl);
    if (!rawId || !containerRef.current) return;
    const videoId: string = rawId;

    const container = containerRef.current;
    const id = "yt-player-" + Math.random().toString(36).slice(2);
    container.id = id;

    function createPlayer() {
      if (!window.YT) return;
      const el = document.getElementById(id);
      if (!el) return;
      const player = new window.YT.Player(id, {
        videoId,
        playerVars: {
          enablejsapi: 1,
        },
      });
      playerRef.current = player as YTPlayerInstance;
    }

    let prevReady: (() => void) | undefined;

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevReady?.();
        createPlayer();
      };
      document.head.appendChild(script);
    }

    return () => {
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
      if (prevReady !== undefined) window.onYouTubeIframeAPIReady = prevReady;
    };
  }, [videoUrl]);

  return <div ref={containerRef} className="h-full w-full" />;
}
