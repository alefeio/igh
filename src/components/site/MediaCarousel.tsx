"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { isVideoUrl } from "@/lib/media-url";

type MediaCarouselProps = {
  urls: string[];
  className?: string;
  /** Quantidade de itens visíveis por vez (desktop). Em telas menores cai para 1. */
  visibleCount?: number;
  /**
   * Faixa em largura total, sem gaps/arredondamentos entre itens —
   * para colar no cabeçalho da página.
   */
  fullBleed?: boolean;
  /**
   * Deslize contínuo lento da esquerda para a direita;
   * pausa com o mouse em cima.
   */
  autoScroll?: boolean;
};

function MediaThumb({ url, fullBleed }: { url: string; fullBleed?: boolean }) {
  if (isVideoUrl(url)) {
    return (
      <video
        src={url}
        className={
          fullBleed
            ? "pointer-events-none h-full w-full bg-black object-cover"
            : "pointer-events-none h-full w-full rounded-lg bg-black object-cover"
        }
        muted
        playsInline
        preload="metadata"
        aria-hidden
      />
    );
  }
  return (
    <img
      src={url}
      alt=""
      className={
        fullBleed
          ? "pointer-events-none h-full w-full object-cover"
          : "pointer-events-none h-full w-full rounded-lg object-cover"
      }
      loading="lazy"
    />
  );
}

function MediaLightbox({
  items,
  activeIndex,
  onClose,
  onChange,
}: {
  items: string[];
  activeIndex: number;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const url = items[activeIndex];
  const n = items.length;
  const canNav = n > 1;

  const go = useCallback(
    (delta: number) => {
      onChange((activeIndex + delta + n) % n);
    },
    [activeIndex, n, onChange]
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Visualização da mídia"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-20 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-5 sm:top-5"
        aria-label="Fechar"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {canNav && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
          aria-label="Mídia anterior"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {canNav && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
          aria-label="Próxima mídia"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <div
        className="relative flex max-h-full max-w-6xl items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideoUrl(url) ? (
          <video
            key={url}
            src={url}
            className="max-h-[85vh] max-w-full rounded-lg bg-black object-contain"
            controls
            autoPlay
            playsInline
          />
        ) : (
          <img
            key={url}
            src={url}
            alt=""
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
        )}
      </div>

      {canNav && (
        <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-white/80">
          {activeIndex + 1} / {n}
        </p>
      )}
    </div>
  );
}

export function MediaCarousel({
  urls,
  className = "",
  visibleCount = 3,
  fullBleed = false,
  autoScroll = false,
}: MediaCarouselProps) {
  const items = useMemo(() => urls.map((u) => u.trim()).filter(Boolean), [urls]);
  const n = items.length;
  const [index, setIndex] = useState(0);
  const [isNarrow, setIsNarrow] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const perView = isNarrow ? 1 : Math.min(visibleCount, Math.max(n, 1));
  const maxStart = Math.max(0, n - perView);
  const useMarquee = autoScroll && n > 1 && !reduceMotion;

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

  const lightbox =
    portalReady &&
    lightboxIndex != null &&
    createPortal(
      <MediaLightbox
        items={items}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChange={setLightboxIndex}
      />,
      document.body
    );

  if (useMarquee) {
    // Duplicar a faixa para loop contínuo; duração proporcional à quantidade de itens.
    const loop = [...items, ...items];
    const total = loop.length;
    const durationSec = Math.max(24, n * 8);
    const paused = hoverPaused || lightboxIndex != null;
    const trackWidthPercent = (total / perView) * 100;
    const itemWidthPercent = 100 / total;

    return (
      <div
        className={`relative w-full overflow-hidden ${className}`}
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
      >
        <style>{`
          @keyframes media-carousel-ltr {
            from { transform: translate3d(-50%, 0, 0); }
            to { transform: translate3d(0, 0, 0); }
          }
          .media-carousel-marquee-track {
            display: flex;
            animation: media-carousel-ltr var(--marquee-duration, 40s) linear infinite;
            will-change: transform;
          }
          .media-carousel-marquee-track.is-paused {
            animation-play-state: paused;
          }
        `}</style>
        <div
          className={`media-carousel-marquee-track ${paused ? "is-paused" : ""}`}
          style={{
            width: `${trackWidthPercent}%`,
            ["--marquee-duration" as string]: `${durationSec}s`,
          }}
        >
          {loop.map((url, i) => {
            const absoluteIndex = i % n;
            return (
              <button
                key={`${i}-${url}`}
                type="button"
                onClick={() => setLightboxIndex(absoluteIndex)}
                className={`group relative shrink-0 cursor-zoom-in overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                  fullBleed
                    ? "aspect-[16/10] sm:aspect-[16/9] lg:aspect-[21/9]"
                    : `aspect-[4/3] ${fullBleed ? "" : "px-1.5"}`
                }`}
                style={{ width: `${itemWidthPercent}%` }}
                aria-label={isVideoUrl(url) ? "Abrir vídeo" : "Abrir imagem"}
              >
                <span
                  className={
                    fullBleed
                      ? "absolute inset-0"
                      : "absolute inset-1.5 overflow-hidden rounded-lg"
                  }
                >
                  <MediaThumb url={url} fullBleed={fullBleed} />
                  <span
                    className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/15"
                    aria-hidden
                  />
                </span>
              </button>
            );
          })}
        </div>
        {lightbox}
      </div>
    );
  }

  const windowItems = items.slice(index, index + perView);
  const showArrows = n > perView;

  return (
    <div className={`relative w-full ${className}`}>
      <div
        className={`grid w-full ${fullBleed ? "gap-0" : "gap-3"} ${
          perView === 1 ? "grid-cols-1" : perView === 2 ? "grid-cols-2" : "grid-cols-3"
        }`}
      >
        {windowItems.map((url, i) => {
          const absoluteIndex = index + i;
          return (
            <button
              key={`${index}-${i}-${url}`}
              type="button"
              onClick={() => setLightboxIndex(absoluteIndex)}
              className={`group relative cursor-zoom-in overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                fullBleed
                  ? "aspect-[16/10] sm:aspect-[16/9] lg:aspect-[21/9]"
                  : "aspect-[4/3] rounded-lg"
              }`}
              aria-label={isVideoUrl(url) ? "Abrir vídeo" : "Abrir imagem"}
            >
              <MediaThumb url={url} fullBleed={fullBleed} />
              <span
                className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/15"
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      {showArrows && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2.5 text-white shadow-md hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              fullBleed ? "left-3 sm:left-4" : "left-0 -translate-x-1/2 sm:left-2 sm:translate-x-0"
            }`}
            aria-label="Anterior"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2.5 text-white shadow-md hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              fullBleed ? "right-3 sm:right-4" : "right-0 translate-x-1/2 sm:right-2 sm:translate-x-0"
            }`}
            aria-label="Próximo"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {showArrows && (
        <div
          className={`flex justify-center gap-1.5 ${
            fullBleed ? "absolute bottom-3 left-0 right-0 z-10" : "mt-3"
          }`}
        >
          {Array.from({ length: maxStart + 1 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-colors ${
                i === index
                  ? fullBleed
                    ? "w-6 bg-white"
                    : "w-6 bg-[var(--igh-primary)]"
                  : fullBleed
                    ? "w-2 bg-white/50 hover:bg-white/80"
                    : "w-2 bg-[var(--igh-muted)]/50 hover:bg-[var(--igh-muted)]"
              }`}
              aria-label={`Ir para posição ${i + 1}`}
            />
          ))}
        </div>
      )}

      {lightbox}
    </div>
  );
}
