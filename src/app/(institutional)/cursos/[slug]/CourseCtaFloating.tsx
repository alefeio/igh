"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type CourseCtaFloatingProps = { courseId: string };

export function CourseCtaFloating({ courseId }: CourseCtaFloatingProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showFloating, setShowFloating] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloating(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-0 w-full" aria-hidden />
      {showFloating && (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--igh-border)] bg-[var(--card-bg)]/95 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.08)] backdrop-blur-sm"
      role="complementary"
      aria-label="Inscrição"
    >
      <div className="mx-auto flex max-w-6xl justify-center px-4 sm:px-6 lg:px-8">
        <Link
          href={`/inscreva?courseId=${encodeURIComponent(courseId)}`}
          className="flex w-full max-w-sm items-center justify-center rounded-lg bg-[var(--igh-primary)] px-6 py-3 text-base font-semibold text-white transition-colors hover:opacity-90"
        >
          Inscreva-se
        </Link>
      </div>
    </div>
      )}
    </>
  );
}
