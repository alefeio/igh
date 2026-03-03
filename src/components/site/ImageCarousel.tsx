"use client";

import { useState, useCallback } from "react";

type ImageCarouselProps = { images: string[]; className?: string };

export function ImageCarousel({ images, className = "" }: ImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const n = images.length;
  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + n) % n);
    },
    [n]
  );

  if (n === 0) return null;
  if (n === 1) {
    return (
      <div className={className}>
        <img src={images[0]} alt="" className="w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="overflow-hidden rounded-lg">
        <img
          src={images[index]}
          alt=""
          className="w-full rounded-lg"
        />
      </div>
      <button
        type="button"
        onClick={() => go(-1)}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Imagem anterior"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Próxima imagem"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <div className="mt-2 flex justify-center gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-colors ${
              i === index ? "w-6 bg-[var(--igh-primary)]" : "w-2 bg-[var(--igh-muted)]/50 hover:bg-[var(--igh-muted)]"
            }`}
            aria-label={`Ir para imagem ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
