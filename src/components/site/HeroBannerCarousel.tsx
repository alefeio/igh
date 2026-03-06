"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "./Button";
import { Container } from "./Container";

export type HeroBannerItem = {
  id: string;
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
  order: number;
};

const ROTATION_INTERVAL_MS = 6000;

type HeroBannerCarouselProps = {
  banners: HeroBannerItem[];
  className?: string;
};

export function HeroBannerCarousel({ banners, className = "" }: HeroBannerCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = banners.length;

  const goTo = useCallback(
    (next: number) => {
      if (n <= 1) return;
      setIndex((next + n) % n);
    },
    [n]
  );

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % n);
  }, [n]);

  useEffect(() => {
    if (n <= 1 || paused) return;
    const id = setInterval(goNext, ROTATION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [n, goNext, paused]);

  if (banners.length === 0) return null;

  const current = banners[index];

  return (
    <section
      className={`relative flex h-[60vh] flex-col justify-end overflow-hidden bg-[var(--igh-surface)] sm:h-screen ${className}`}
      aria-label="Banner principal"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides (stacked, fade via opacity) */}
      {banners.map((banner, i) => (
        <div
          key={banner.id}
          className="absolute inset-0 z-0 transition-opacity duration-[400ms] ease-out"
          style={{
            opacity: i === index ? 1 : 0,
            pointerEvents: i === index ? "auto" : "none",
          }}
          aria-hidden={i !== index}
        >
          {banner.imageUrl && (
            <div className="absolute inset-0">
              <img
                src={banner.imageUrl}
                alt=""
                className="h-full w-full object-cover opacity-55"
              />
              <div className="absolute inset-0 bg-black/40" aria-hidden />
            </div>
          )}
          <Container className="relative z-10 flex h-full min-h-0 flex-col justify-end pb-12 pt-16 sm:pb-28 sm:pt-24">
            <div className="mx-auto mt-auto max-w-3xl text-center">
              {banner.title && (
                <h1
                  className={`text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl ${
                    banner.imageUrl
                      ? "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                      : "text-[var(--igh-secondary)]"
                  }`}
                >
                  {banner.title}
                </h1>
              )}
              {banner.subtitle && (
                <p
                  className={`mt-4 text-lg ${
                    banner.imageUrl
                      ? "text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                      : "text-[var(--igh-muted)]"
                  }`}
                >
                  {banner.subtitle}
                </p>
              )}
              {banner.ctaLabel && banner.ctaHref ? (
                <div className="mt-8">
                  <Button as="link" href={banner.ctaHref} variant="primary" size="lg">
                    {banner.ctaLabel}
                  </Button>
                </div>
              ) : null}
            </div>
          </Container>
        </div>
      ))}

      {/* Indicadores (dots) */}
      {n > 1 && (
        <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-2">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all duration-200 ${
                i === index
                  ? "w-8 bg-[var(--igh-primary)]"
                  : "w-2 bg-white/60 hover:bg-white/80 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-white"
              }`}
              aria-label={`Ir para slide ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
            />
          ))}
        </div>
      )}

      {/* Botões anterior / próximo (opcional, para acessibilidade e uso em desktop) */}
      {n > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2.5 text-white hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white sm:left-4"
            aria-label="Banner anterior"
          >
            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2.5 text-white hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white sm:right-4"
            aria-label="Próximo banner"
          >
            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </section>
  );
}
