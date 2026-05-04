"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent as ReactMouseEvent, MutableRefObject, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const BANNER_SLIDE_MS = 520;
const BANNER_SLIDE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export type TabletBannerSlide = {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  linkHref?: string | null;
};

type Props = {
  banners: TabletBannerSlide[];
  /** `fullscreen` = página /tablet/banners; `embedded` = topo do /dashboard do aluno */
  mode: "fullscreen" | "embedded";
  className?: string;
};

function BannerHitLayer({
  href,
  ariaLabel,
  blockLinkNavigationRef,
}: {
  href: string;
  ariaLabel: string;
  blockLinkNavigationRef: MutableRefObject<boolean>;
}) {
  const onClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (blockLinkNavigationRef.current) {
      e.preventDefault();
      blockLinkNavigationRef.current = false;
    }
  };

  const className =
    "absolute inset-0 z-[1] block cursor-pointer outline-none ring-inset focus-visible:ring-2 focus-visible:ring-white/60";

  if (href.startsWith("/") && !href.startsWith("//")) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel} onClick={onClick}>
        <span className="sr-only">{ariaLabel}</span>
      </Link>
    );
  }
  const external = /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span className="sr-only">{ariaLabel}</span>
    </a>
  );
}

/** Legenda integrada à imagem: vidro suave, pouca borda/sombra — menos “cartão” */
function BannerCaptionPanel({
  mode,
  children,
}: {
  mode: "fullscreen" | "embedded";
  children: ReactNode;
}) {
  const isFs = mode === "fullscreen";
  return (
    <div
      className={
        isFs
          ? "pointer-events-none relative inline-block max-w-[min(36rem,calc(100%-2rem))] rounded-xl bg-black/28 px-5 py-4 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.35)] backdrop-blur-xl backdrop-saturate-150 sm:rounded-2xl sm:px-6 sm:py-[1.125rem]"
          : "pointer-events-none relative inline-block max-w-[min(32rem,calc(100%-2rem))] rounded-lg bg-black/32 px-4 py-3 shadow-[0_6px_24px_-6px_rgba(0,0,0,0.3)] backdrop-blur-lg backdrop-saturate-150 sm:rounded-xl sm:px-5 sm:py-3.5"
      }
    >
      {children}
    </div>
  );
}

function SlideContent({
  banner,
  fallbackTitle,
  mode,
  blockLinkNavigationRef,
}: {
  banner: TabletBannerSlide;
  fallbackTitle: string;
  mode: "fullscreen" | "embedded";
  blockLinkNavigationRef: MutableRefObject<boolean>;
}) {
  const href = banner.linkHref?.trim() ?? "";
  const hasLink = href.length > 0;
  const ariaLabel = banner.title?.trim() || "Abrir link do banner";

  const isFs = mode === "fullscreen";
  const posClass = isFs ? "bottom-4 left-4 sm:bottom-5 sm:left-5" : "bottom-3 left-3 sm:bottom-4 sm:left-4";
  const titleCls = isFs
    ? "text-balance font-semibold leading-tight tracking-tight text-white text-xl sm:text-2xl"
    : "text-balance font-semibold leading-tight tracking-tight text-white text-lg sm:text-xl";
  const subCls = isFs
    ? "mt-2 max-w-prose text-pretty text-sm leading-relaxed text-zinc-200 sm:text-base"
    : "mt-1.5 max-w-prose text-pretty text-xs leading-relaxed text-zinc-200/95 sm:text-sm";

  const captionLines = (
    <>
      {banner.title?.trim() ? <p className={titleCls}>{banner.title.trim()}</p> : null}
      {banner.subtitle?.trim() ? <p className={subCls}>{banner.subtitle.trim()}</p> : null}
    </>
  );

  const caption =
    (banner.title && banner.title.trim()) || (banner.subtitle && banner.subtitle.trim()) ? (
      <div className={`pointer-events-none absolute z-10 text-left ${posClass}`}>
        <BannerCaptionPanel mode={mode}>{captionLines}</BannerCaptionPanel>
      </div>
    ) : null;

  return (
    <div className="relative h-full w-full">
      {hasLink ? <BannerHitLayer href={href} ariaLabel={ariaLabel} blockLinkNavigationRef={blockLinkNavigationRef} /> : null}

      {banner.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banner.imageUrl}
          alt=""
          role="presentation"
          className="pointer-events-none relative z-0 h-full w-full object-cover"
        />
      ) : (
        <div className="pointer-events-none flex h-full w-full flex-col justify-end px-4 pb-4 text-left sm:px-5 sm:pb-5">
          <BannerCaptionPanel mode={mode}>
            <h1 className={titleCls}>{banner.title?.trim() || fallbackTitle}</h1>
            {banner.subtitle?.trim() ? <p className={subCls}>{banner.subtitle.trim()}</p> : null}
          </BannerCaptionPanel>
        </div>
      )}

      {banner.imageUrl ? caption : null}
    </div>
  );
}

export function TabletBannerViewer({ banners, mode, className = "" }: Props) {
  const router = useRouter();
  const blockLinkNavigationRef = useRef(false);
  const slides = useMemo(
    () =>
      banners.filter(
        (b) =>
          (b.title && b.title.trim()) ||
          (b.subtitle && b.subtitle.trim()) ||
          (b.imageUrl && b.imageUrl.trim()) ||
          (b.linkHref && b.linkHref.trim()),
      ),
    [banners],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showClose, setShowClose] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const isMouseDragRef = useRef(false);
  const isSlidingRef = useRef(false);
  const slideTimeoutRef = useRef<number | null>(null);
  const [slideOffset, setSlideOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  /** Falso só no frame em que zeramos o offset após a troca — evita animar -width→0 (efeito de “dois passos”) */
  const [slideCssTransition, setSlideCssTransition] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const width = viewportWidth || 400;
  const slideTransitionStyle =
    isDragging || !slideCssTransition
      ? "none"
      : `transform ${BANNER_SLIDE_MS}ms ${BANNER_SLIDE_EASING}`;

  const completeSlide = useCallback(
    (direction: "next" | "prev") => {
      if (slides.length <= 1) return;
      if (isSlidingRef.current) return;
      isSlidingRef.current = true;
      setIsDragging(false);
      setSlideCssTransition(true);
      setSlideOffset(direction === "next" ? -width : width);
      if (slideTimeoutRef.current) window.clearTimeout(slideTimeoutRef.current);
      slideTimeoutRef.current = window.setTimeout(() => {
        slideTimeoutRef.current = null;
        setSlideCssTransition(false);
        setCurrentIndex((prev) =>
          direction === "next" ? (prev + 1) % slides.length : prev === 0 ? slides.length - 1 : prev - 1,
        );
        setSlideOffset(0);
        isSlidingRef.current = false;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setSlideCssTransition(true);
          });
        });
      }, BANNER_SLIDE_MS);
    },
    [slides.length, width],
  );

  useEffect(() => {
    return () => {
      if (slideTimeoutRef.current) window.clearTimeout(slideTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!slides.length) return;
    const id = window.setInterval(() => {
      if (!isSlidingRef.current) completeSlide("next");
    }, 15000);
    return () => window.clearInterval(id);
  }, [slides.length, currentIndex, completeSlide]);

  const goToSlideIndex = useCallback(
    (index: number) => {
      if (index === currentIndex || isSlidingRef.current || !slides.length) return;
      setCurrentIndex(index);
      setSlideOffset(0);
    },
    [currentIndex, slides.length],
  );

  useEffect(() => {
    if (mode !== "fullscreen") return;
    const handleMove = (e: globalThis.MouseEvent) => {
      if (e.clientY <= 24) setShowClose(true);
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [mode]);

  useEffect(() => {
    if (mode === "fullscreen") {
      const update = () => setViewportWidth(window.innerWidth || 0);
      update();
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportWidth(el.clientWidth || 0));
    ro.observe(el);
    setViewportWidth(el.clientWidth || 0);
    return () => ro.disconnect();
  }, [mode, slides.length]);

  useEffect(() => {
    function handleGlobalMouseUp(e: globalThis.MouseEvent) {
      if (!isMouseDragRef.current) return;
      isMouseDragRef.current = false;
      const startX = touchStartXRef.current;
      touchStartXRef.current = null;
      setIsDragging(false);
      if (startX == null) return;
      const deltaX = e.clientX - startX;
      const threshold = 80;
      if (!slides.length || Math.abs(deltaX) < threshold) {
        setSlideOffset(0);
        return;
      }
      blockLinkNavigationRef.current = true;
      if (deltaX < 0) completeSlide("next");
      else completeSlide("prev");
    }
    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => document.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [slides.length, completeSlide]);

  const current = slides[currentIndex] ?? null;
  const showNeighbor = Math.abs(slideOffset) > 0;
  const neighborIndex =
    showNeighbor && slides.length > 0
      ? slideOffset < 0
        ? (currentIndex + 1) % slides.length
        : (currentIndex - 1 + slides.length) % slides.length
      : null;
  const neighbor = neighborIndex != null && slides.length > 0 ? slides[neighborIndex] : null;

  const fallbackTitle = mode === "fullscreen" ? "Banner para tablet" : "Banner";

  const outerFullscreen = "fixed inset-0 z-[80] bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white";
  const outerEmbedded = `relative w-full overflow-hidden rounded-2xl border border-[var(--card-border)] bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white shadow-lg ${className}`;

  const innerHeightClass =
    mode === "fullscreen" ? "relative flex h-full w-full items-center justify-center overflow-hidden" : "relative flex h-[min(42vh,26rem)] w-full min-h-[220px] items-center justify-center overflow-hidden sm:h-[min(40vh,28rem)] sm:min-h-[260px]";

  if (!slides.length) {
    if (mode === "fullscreen") {
      return (
        <div className={`${outerFullscreen} flex items-center justify-center text-center text-white/70`}>
          Nenhum banner ativo para exibir.
        </div>
      );
    }
    return null;
  }

  const showNav = slides.length > 1;
  const navBtnClass =
    "pointer-events-auto absolute top-1/2 z-[35] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-zinc-950/55 text-white shadow-lg backdrop-blur-md transition hover:bg-zinc-900/75 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/70 sm:h-11 sm:w-11";

  return (
    <div
      ref={containerRef}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Banners em destaque"
      className={mode === "fullscreen" ? outerFullscreen : outerEmbedded}
    >
      {mode === "fullscreen" && showClose ? (
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute right-4 top-2 z-[90] rounded-full bg-black/70 px-3 py-1 text-sm font-medium text-white hover:bg-black/90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          X
        </button>
      ) : null}

      {current ? (
        <div
          className={innerHeightClass}
          onTouchStart={(e) => {
            if (isSlidingRef.current) return;
            blockLinkNavigationRef.current = false;
            if (e.touches.length > 0) {
              touchStartXRef.current = e.touches[0].clientX;
              setIsDragging(true);
              setSlideOffset(0);
            }
          }}
          onTouchMove={(e) => {
            const startX = touchStartXRef.current;
            if (startX == null) return;
            const currentX = e.touches[0]?.clientX ?? startX;
            setSlideOffset(currentX - startX);
          }}
          onTouchEnd={(e) => {
            const startX = touchStartXRef.current;
            touchStartXRef.current = null;
            setIsDragging(false);
            if (startX == null) return;
            const endX = e.changedTouches[0]?.clientX ?? startX;
            const deltaX = endX - startX;
            const threshold = 80;
            if (!slides.length || Math.abs(deltaX) < threshold) {
              setSlideOffset(0);
              return;
            }
            blockLinkNavigationRef.current = true;
            if (deltaX < 0) completeSlide("next");
            else completeSlide("prev");
          }}
          onMouseDown={(e) => {
            if (isSlidingRef.current) return;
            e.preventDefault();
            blockLinkNavigationRef.current = false;
            touchStartXRef.current = e.clientX;
            isMouseDragRef.current = true;
            setIsDragging(true);
            setSlideOffset(0);
          }}
          onMouseMove={(e) => {
            if (touchStartXRef.current == null) return;
            setSlideOffset(e.clientX - touchStartXRef.current);
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translateX(${slideOffset}px)`,
              transition: slideTransitionStyle,
            }}
          >
            <SlideContent
              banner={current}
              fallbackTitle={fallbackTitle}
              mode={mode}
              blockLinkNavigationRef={blockLinkNavigationRef}
            />
          </div>

          {neighbor ? (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `translateX(${slideOffset < 0 ? slideOffset + width : slideOffset - width}px)`,
                transition: slideTransitionStyle,
              }}
            >
              <SlideContent
                banner={neighbor}
                fallbackTitle={fallbackTitle}
                mode={mode}
                blockLinkNavigationRef={blockLinkNavigationRef}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {showNav ? (
        <>
          <button
            type="button"
            aria-label="Banner anterior"
            className={`${navBtnClass} left-2 sm:left-3`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              blockLinkNavigationRef.current = true;
              completeSlide("prev");
            }}
          >
            <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Próximo banner"
            className={`${navBtnClass} right-2 sm:right-3`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              blockLinkNavigationRef.current = true;
              completeSlide("next");
            }}
          >
            <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </button>
          <div
            className="pointer-events-auto absolute bottom-3 left-1/2 z-[35] flex -translate-x-1/2 gap-2 sm:bottom-4"
            role="tablist"
            aria-label="Selecionar banner"
          >
            {slides.map((s, i) => {
              const active = i === currentIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`Banner ${i + 1} de ${slides.length}`}
                  className={
                    active
                      ? "h-2.5 w-2.5 rounded-full bg-white shadow-sm ring-2 ring-white/40 transition sm:h-3 sm:w-3"
                      : "h-2 w-2 rounded-full bg-white/35 transition hover:bg-white/60 sm:h-2.5 sm:w-2.5"
                  }
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToSlideIndex(i);
                  }}
                />
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
