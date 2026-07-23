"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isVideoUrl } from "@/lib/media-url";

type MediaCarouselProps = {
  urls: string[];
  className?: string;
  /** Quantidade de itens visíveis por vez (desktop). Em telas menores cai para 1. */
  visibleCount?: number;
};

function MediaSlide({ url }: { url: string }) {
  if (isVideoUrl(url)) {
    return (
      <video
        src={url}
        className="h-full w-full rounded-lg bg-black object-cover"
        controls
        playsInline
        preload="metadata"
      />
    );
  }
  return <img src={url} alt="" className="h-full w-full rounded-lg object-cover" loading="lazy" />;
}

export function MediaCarousel({ urls, className = "", visibleCount = 3 }: MediaCarouselProps) {
  const items = useMemo(() => urls.map((u) => u.trim()).filter(Boolean), [urls]);
  const n = items.length;
  const [index, setIndex] = useState(0);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const perView = isNarrow ? 1 : Math.min(visibleCount, Math.max(n, 1));
  const maxStart = Math.max(0, n - perView);

  useEffect(() => {
    setIndex((i) => Math.min(i, maxStart));
  }, [maxStart]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const next = i + delta;
        if (next < 0) return maxStart;
        if (next > maxStart) return 0;
        return next;
      });
    },
    [maxStart]
  );

  if (n === 0) return null;

  const windowItems = items.slice(index, index + perView);
  const showArrows = n > perView;

  return (
    <div className={`relative ${className}`}>
      <div
        className={`grid gap-3 ${
          perView === 1 ? "grid-cols-1" : perView === 2 ? "grid-cols-2" : "grid-cols-3"
        }`}
      >
        {windowItems.map((url, i) => (
          <div key={`${index}-${i}-${url}`} className="aspect-[4/3] overflow-hidden rounded-lg">
            <MediaSlide url={url} />
          </div>
        ))}
      </div>

      {showArrows && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2.5 text-white shadow-md hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-2 sm:translate-x-0"
            aria-label="Anterior"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-0 top-1/2 z-10 translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2.5 text-white shadow-md hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-2 sm:translate-x-0"
            aria-label="Próximo"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {showArrows && (
        <div className="mt-3 flex justify-center gap-1.5">
          {Array.from({ length: maxStart + 1 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-colors ${
                i === index ? "w-6 bg-[var(--igh-primary)]" : "w-2 bg-[var(--igh-muted)]/50 hover:bg-[var(--igh-muted)]"
              }`}
              aria-label={`Ir para posição ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
