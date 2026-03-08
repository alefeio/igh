"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
    <div className="flex flex-col gap-4">
      <Link className="text-sm text-[var(--igh-primary)] underline hover:no-underline" href="/minhas-turmas">
        ← Voltar às turmas
      </Link>

      <div className="card">
        <div className="card-header">
          <div className="text-lg font-semibold text-[var(--text-primary)]">Minha lista de favoritos</div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Aulas que você marcou como favoritas.</p>
        </div>
        <div className="card-body">
          {loading ? (
            <p className="text-[var(--text-secondary)]">Carregando...</p>
          ) : favorites.length === 0 ? (
            <p className="text-[var(--text-secondary)]">Nenhuma aula favoritada. Marque aulas como favoritas na página da aula (ícone de estrela).</p>
          ) : (
            <ul className="space-y-3">
              {favorites.map((fav) => (
                <li
                  key={`${fav.enrollmentId}-${fav.lessonId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-4"
                >
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">{fav.lessonTitle}</div>
                    <div className="text-sm text-[var(--text-muted)]">
                      {fav.courseName} · {fav.moduleTitle}
                    </div>
                  </div>
                  <Link
                    href={`/minhas-turmas/${fav.enrollmentId}/conteudo/aula/${fav.lessonId}`}
                    className="rounded bg-[var(--igh-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    Abrir aula
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
