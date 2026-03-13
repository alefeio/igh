"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { ApiResponse } from "@/lib/api-types";

type TabletBanner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  order: number;
  isActive: boolean;
};

export default function TabletBannersFullscreenPage() {
  const router = useRouter();
  const [banners, setBanners] = useState<TabletBanner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showClose, setShowClose] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const [slideOffset, setSlideOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/tablet/banners");
        const json = (await res.json()) as ApiResponse<{ items: TabletBanner[] }>;
        if (res.ok && json?.ok) {
          const active = (json.data.items ?? []).filter((b) => b.isActive);
          setBanners(active);
        } else {
          setBanners([]);
        }
      } catch {
        setBanners([]);
      }
    }
    void load();
  }, []);

  const goToNext = useCallback(() => {
    if (!banners.length) return;
    setSlideOffset(64);
    // novo banner entra da direita para o centro (efeito indo para a esquerda)
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const goToPrev = useCallback(() => {
    if (!banners.length) return;
    setSlideOffset(-64);
    // novo banner entra da esquerda para o centro (efeito indo para a direita)
    setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  }, [banners.length]);

  // Anima o banner atual da posição deslocada até o centro
  useEffect(() => {
    if (slideOffset === 0) return;
    const id = window.requestAnimationFrame(() => {
      setSlideOffset(0);
    });
    return () => window.cancelAnimationFrame(id);
  }, [currentIndex, slideOffset]);

  // Rotação simples entre banners ativos
  useEffect(() => {
    if (!banners.length) return;
    const id = window.setInterval(() => {
      goToNext();
    }, 15000);
    return () => window.clearInterval(id);
  }, [banners.length, goToNext]);

  // Detecta mouse no topo para mostrar o botão de fechar
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (e.clientY <= 24) {
        setShowClose(true);
      }
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const current = banners[currentIndex] ?? null;
  const neighborIndex =
    isDragging && Math.abs(slideOffset) > 0
      ? slideOffset < 0
        ? (currentIndex + 1) % banners.length
        : (currentIndex - 1 + banners.length) % Math.max(banners.length, 1)
      : null;
  const neighbor =
    neighborIndex != null && banners.length > 0 ? banners[neighborIndex] : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      setViewportWidth(window.innerWidth || 0);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="fixed inset-0 z-[80] bg-black text-white">
      {/* Botão de fechar (só aparece ao encostar o mouse no topo) */}
      {showClose && (
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute right-4 top-2 z-[90] rounded-full bg-black/70 px-3 py-1 text-sm font-medium text-white hover:bg-black/90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          X
        </button>
      )}

      {current ? (
        <div
          className="relative flex h-full w-full items-center justify-center overflow-hidden"
          onTouchStart={(e) => {
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
            const deltaX = currentX - startX;
            setSlideOffset(deltaX);
          }}
          onTouchEnd={(e) => {
            const startX = touchStartXRef.current;
            touchStartXRef.current = null;
            setIsDragging(false);
            if (startX == null) return;
            const endX = e.changedTouches[0]?.clientX ?? startX;
            const deltaX = endX - startX;
            const threshold = 80;
            if (!banners.length || Math.abs(deltaX) < threshold) {
              // volta para a posição original
              setSlideOffset(0);
              return;
            }
            const width = viewportWidth || 400;
            if (deltaX < 0) {
              // arrastou para a esquerda: atual sai para a esquerda, próximo entra
              setSlideOffset(-width);
              window.setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % banners.length);
                setSlideOffset(0);
              }, 450);
            } else {
              // arrastou para a direita: atual sai para a direita, anterior entra
              setSlideOffset(width);
              window.setTimeout(() => {
                setCurrentIndex((prev) =>
                  prev === 0 ? banners.length - 1 : prev - 1,
                );
                setSlideOffset(0);
              }, 450);
            }
          }}
        >
          {/* Slide atual */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translateX(${slideOffset}px)`,
              transition: isDragging ? "none" : "transform 450ms ease-out",
            }}
          >
            {current.imageUrl ? (
              <img
                src={current.imageUrl}
                alt={current.title ?? ""}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-8 text-center">
                <div>
                  <h1 className="text-3xl font-bold">
                    {current.title || "Banner para tablet"}
                  </h1>
                  {current.subtitle && (
                    <p className="mt-3 text-lg text-white/80">
                      {current.subtitle}
                    </p>
                  )}
                </div>
              </div>
            )}

            {(current.title || current.subtitle) && (
              <div className="pointer-events-none absolute inset-0 flex items-end justify-center">
                <div className="w-full bg-gradient-to-t from-black via-black/90 to-black/50 px-12 pb-16 pt-12 text-center sm:px-16 sm:pb-20 sm:pt-14">
                  {current.title && (
                    <h1 className="text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl">
                      {current.title}
                    </h1>
                  )}
                  {current.subtitle && (
                    <p className="mt-5 text-3xl text-white/90 sm:text-4xl">
                      {current.subtitle}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Próximo/Anterior aparecendo ao lado durante o arraste */}
          {neighbor && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `translateX(${
                  slideOffset < 0
                    ? slideOffset + (viewportWidth || 400)
                    : slideOffset - (viewportWidth || 400)
                }px)`,
                transition: isDragging ? "none" : "transform 450ms ease-out",
              }}
            >
              {neighbor.imageUrl ? (
                <img
                  src={neighbor.imageUrl}
                  alt={neighbor.title ?? ""}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-8 text-center">
                  <div>
                    <h1 className="text-3xl font-bold">
                      {neighbor.title || "Banner para tablet"}
                    </h1>
                    {neighbor.subtitle && (
                      <p className="mt-3 text-lg text-white/80">
                        {neighbor.subtitle}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(neighbor.title || neighbor.subtitle) && (
                <div className="pointer-events-none absolute inset-0 flex items-end justify-center">
                  <div className="w-full bg-gradient-to-t from-black via-black/90 to-black/50 px-12 pb-16 pt-12 text-center sm:px-16 sm:pb-20 sm:pt-14">
                    {neighbor.title && (
                      <h1 className="text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl">
                        {neighbor.title}
                      </h1>
                    )}
                    {neighbor.subtitle && (
                      <p className="mt-5 text-3xl text-white/90 sm:text-4xl">
                        {neighbor.subtitle}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-center text-white/70">
          Nenhum banner ativo para exibir.
        </div>
      )}
    </div>
  );
}

