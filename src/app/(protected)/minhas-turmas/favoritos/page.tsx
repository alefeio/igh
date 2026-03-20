"use client";

import { ArrowLeft, BookOpen, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type FavoriteItem = {
  enrollmentId: string;
  lessonId: string;
  courseName: string;
  moduleTitle: string;
  lessonTitle: string;
  createdAt: string;
};

export default function FavoritosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/me/favorites");
        const json = (await res.json()) as ApiResponse<{ favorites: FavoriteItem[] }>;
        if (res.ok && json?.ok) setFavorites(json.data.favorites);
        else toast.push("error", json && "error" in json ? json.error.message : "Falha ao carregar favoritos.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [toast]);

  return (
    <div className="flex min-w-0 flex-col gap-8 pb-4 sm:gap-10">
      <nav aria-label="Navegação">
        <Link
          href="/minhas-turmas"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
          Voltar às turmas
        </Link>
      </nav>

      <DashboardHero
        eyebrow="Revisão"
        title="Minha lista de favoritos"
        description="Aulas que você marcou com estrela para encontrar rápido depois."
        rightSlot={
          <div className="hidden items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 shadow-sm sm:flex">
            <Star className="h-8 w-8 shrink-0 text-amber-500" aria-hidden />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Dica</p>
              <p className="text-sm font-bold text-[var(--text-primary)]">Marque aulas na página da lição</p>
            </div>
          </div>
        }
      />

      <SectionCard
        title="Aulas favoritas"
        description={loading ? "Carregando…" : `${favorites.length} ${favorites.length === 1 ? "aula salva" : "aulas salvas"}.`}
        variant="elevated"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12" role="status">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--igh-primary)]/20" aria-hidden />
            <p className="mt-3 text-sm text-[var(--text-muted)]">Carregando favoritos…</p>
          </div>
        ) : favorites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-6 py-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-[var(--text-muted)]" aria-hidden />
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
              Nenhuma aula favoritada ainda. Abra uma aula e toque na estrela para adicionar aqui.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {favorites.map((fav) => (
              <li
                key={`${fav.enrollmentId}-${fav.lessonId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm transition hover:border-[var(--igh-primary)]/25 sm:p-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[var(--text-primary)]">{fav.lessonTitle}</div>
                  <div className="mt-0.5 text-sm text-[var(--text-muted)]">
                    {fav.courseName} · {fav.moduleTitle}
                  </div>
                </div>
                <Link
                  href={`/minhas-turmas/${fav.enrollmentId}/conteudo/aula/${fav.lessonId}`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--igh-primary)] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[var(--igh-primary)]/20 transition hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                >
                  Abrir aula
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
