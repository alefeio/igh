"use client";

import { Heart } from "lucide-react";

import type { MotherCampaignMessagePublic } from "@/lib/site-data";
import { useEffect, useMemo, useState } from "react";

import { Container } from "./Container";
import { Section } from "./Section";

const LS_PREFIX = "mothers-day-liked:";

export function MothersDayMessagesHomeSection({
  items,
}: {
  items: readonly MotherCampaignMessagePublic[];
}) {
  if (items.length === 0) return null;

  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.likeCount]))
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    // read localStorage once (client only)
    try {
      const s = new Set<string>();
      for (const id of ids) {
        if (window.localStorage.getItem(`${LS_PREFIX}${id}`) === "1") s.add(id);
      }
      setLikedIds(s);
    } catch {
      /* ignore */
    }
  }, [ids]);

  async function likeMessage(responseId: string) {
    if (busyId) return;
    if (likedIds.has(responseId)) return;
    setBusyId(responseId);
    try {
      const res = await fetch(`/api/site/mothers-day/messages/${responseId}/like`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { likeCount?: number };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        // Se já curtiu (409), apenas trava no client para evitar spam.
        if (res.status === 409) {
          try {
            window.localStorage.setItem(`${LS_PREFIX}${responseId}`, "1");
          } catch {
            /* ignore */
          }
          setLikedIds((prev) => new Set(prev).add(responseId));
        } else {
          console.warn("[mothers-day-like]", json.error?.message ?? "Falha ao curtir");
        }
        return;
      }
      const likeCount = typeof json.data?.likeCount === "number" ? json.data.likeCount : undefined;
      if (likeCount != null) {
        setCounts((prev) => ({ ...prev, [responseId]: likeCount }));
      } else {
        setCounts((prev) => ({ ...prev, [responseId]: (prev[responseId] ?? 0) + 1 }));
      }
      try {
        window.localStorage.setItem(`${LS_PREFIX}${responseId}`, "1");
      } catch {
        /* ignore */
      }
      setLikedIds((prev) => new Set(prev).add(responseId));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Section
      title="Homenagens para as mães"
      subtitle="Trechos das declarações que nossos alunos dedicam às suas mães — gratidão em primeiro lugar."
      background="muted"
      headerClassName="text-center"
    >
      <Container>
        <div className="mx-auto mb-8 flex max-w-2xl flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600" aria-hidden>
            <Heart className="h-7 w-7 fill-current" strokeWidth={1.5} aria-hidden />
          </div>
          <p className="text-sm leading-relaxed text-[var(--igh-muted)]">
            Cada cartão abaixo é uma mensagem enviada por um aluno na campanha especial do Dia das Mães. Os nomes são
            exibidos de forma resumida para preservar a privacidade.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((m) => (
            <figure
              key={m.id}
              className="flex h-full flex-col rounded-2xl border border-rose-200/60 bg-gradient-to-b from-white to-rose-50/80 p-5 shadow-sm dark:border-rose-900/40 dark:from-[var(--card-bg)] dark:to-rose-950/30"
            >
              <blockquote className="flex flex-1 flex-col">
                <p className="text-sm leading-relaxed text-[var(--text-primary)]">&ldquo;{m.text}&rdquo;</p>
              </blockquote>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-rose-200/50 pt-3 dark:border-rose-900/50">
                <figcaption className="min-w-0 text-xs font-semibold text-rose-700 dark:text-rose-300">
                  — {m.authorLabel}
                </figcaption>
                <button
                  type="button"
                  onClick={() => void likeMessage(m.id)}
                  disabled={busyId === m.id || likedIds.has(m.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    likedIds.has(m.id)
                      ? "border-rose-300 bg-rose-500/15 text-rose-700 dark:border-rose-900/60 dark:text-rose-300"
                      : "border-rose-200 bg-white/70 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-[var(--card-bg)] dark:text-rose-300"
                  }`}
                  aria-pressed={likedIds.has(m.id)}
                  aria-label={likedIds.has(m.id) ? "Você já curtiu" : "Curtir mensagem"}
                >
                  <Heart
                    className="h-4 w-4"
                    style={
                      likedIds.has(m.id)
                        ? { color: "#e11d48", fill: "#e11d48", stroke: "#e11d48" }
                        : { stroke: "currentColor" }
                    }
                    strokeWidth={likedIds.has(m.id) ? 0 : 1.5}
                    aria-hidden
                  />
                  <span className="tabular-nums">{counts[m.id] ?? m.likeCount ?? 0}</span>
                </button>
              </div>
            </figure>
          ))}
        </div>
      </Container>
    </Section>
  );
}
