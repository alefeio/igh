"use client";

import { Heart } from "lucide-react";

import type { MotherCampaignMessagePublic } from "@/lib/site-data";
import { scheduleOpenMothersCampaignModalAfterAuth } from "@/lib/mothers-day-open-prompt";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/site/Button";

import { Container } from "./Container";
import { Section } from "./Section";

const LS_PREFIX = "mothers-day-liked:";

export function MothersDayMessagesHomeSection({
  items,
  participationOpen,
}: {
  items: readonly MotherCampaignMessagePublic[];
  participationOpen: boolean;
}) {
  if (!participationOpen && items.length === 0) return null;

  const [studentName, setStudentName] = useState<string | null>(null);
  const [studentHasResponded, setStudentHasResponded] = useState<boolean | null>(null);
  const [showAll, setShowAll] = useState(false);

  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.likeCount]))
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadSessionStudent() {
      try {
        const res = await fetch("/api/me/student", { credentials: "include" });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          data?: { student?: { name?: string | null } | null };
        };
        if (!alive) return;
        if (res.ok && json.ok && json.data?.student?.name) {
          setStudentName(String(json.data.student.name));
        } else {
          setStudentName(null);
        }
      } catch {
        if (!alive) return;
        setStudentName(null);
      }
    }
    void loadSessionStudent();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadParticipationStatus() {
      if (!studentName) {
        setStudentHasResponded(null);
        return;
      }
      try {
        const res = await fetch("/api/me/marketing-campaigns/active", { credentials: "include" });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          data?: { hasResponded?: boolean };
        };
        if (!alive) return;
        if (res.ok && json.ok) {
          setStudentHasResponded(!!json.data?.hasResponded);
        } else {
          setStudentHasResponded(null);
        }
      } catch {
        if (!alive) return;
        setStudentHasResponded(null);
      }
    }
    void loadParticipationStatus();
    return () => {
      alive = false;
    };
  }, [studentName]);

  useEffect(() => {
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

  useEffect(() => {
    setCounts((prev) => {
      const next = { ...prev };
      for (const i of items) {
        if (next[i.id] === undefined) next[i.id] = i.likeCount;
      }
      return next;
    });
  }, [items]);

  async function likeMessage(item: MotherCampaignMessagePublic) {
    if (busyId) return;
    if (likedIds.has(item.id)) return;
    setBusyId(item.id);
    try {
      const url =
        item.kind === "guest"
          ? `/api/site/mothers-day/guest-messages/${item.targetId}/like`
          : `/api/site/mothers-day/messages/${item.targetId}/like`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { likeCount?: number };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        if (res.status === 409) {
          try {
            window.localStorage.setItem(`${LS_PREFIX}${item.id}`, "1");
          } catch {
            /* ignore */
          }
          setLikedIds((prev) => new Set(prev).add(item.id));
        } else {
          console.warn("[mothers-day-like]", json.error?.message ?? "Falha ao curtir");
        }
        return;
      }
      const likeCount = typeof json.data?.likeCount === "number" ? json.data.likeCount : undefined;
      if (likeCount != null) {
        setCounts((prev) => ({ ...prev, [item.id]: likeCount }));
      } else {
        setCounts((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }));
      }
      try {
        window.localStorage.setItem(`${LS_PREFIX}${item.id}`, "1");
      } catch {
        /* ignore */
      }
      setLikedIds((prev) => new Set(prev).add(item.id));
    } finally {
      setBusyId(null);
    }
  }

  const visibleItems = showAll ? items : items.slice(0, 9);
  const firstName = (studentName ?? "").trim().split(/\s+/)[0] ?? "";

  return (
    <Section
      title="Homenagens para as mães"
      subtitle="Campanha especial do Dia das Mães — quem estuda no IGH pode enviar uma homenagem pela área do aluno."
      background="muted"
      headerClassName="text-center"
    >
      <Container>
        <div className="mx-auto mb-6 flex max-w-2xl flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600" aria-hidden>
            <Heart className="h-7 w-7 fill-current" strokeWidth={1.5} aria-hidden />
          </div>
          <p className="text-sm leading-relaxed text-[var(--igh-muted)]">
            Ainda não tem conta? Faça um cadastro rápido no site. Assim que entrar na área do aluno, você já cai no
            formulário da campanha (homenagem em corações + mensagem).
          </p>
          <p className="text-sm font-semibold text-[var(--igh-secondary)]">Quer participar?</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {studentName ? (
              <Button
                as="link"
                href="/dashboard"
                variant="primary"
                size="sm"
                onClick={() => scheduleOpenMothersCampaignModalAfterAuth()}
              >
                {studentHasResponded
                  ? `${firstName || "Você"}, você já está participando.`
                  : `Quer participar, ${firstName || "você"}?`}
              </Button>
            ) : (
              <>
                <Button
                  as="link"
                  href="/cadastro?from=/dashboard"
                  variant="primary"
                  size="sm"
                  onClick={() => scheduleOpenMothersCampaignModalAfterAuth()}
                >
                  Criar conta e participar
                </Button>
                <Button
                  as="link"
                  href="/login?from=/dashboard"
                  variant="outline"
                  size="sm"
                  onClick={() => scheduleOpenMothersCampaignModalAfterAuth()}
                >
                  Já sou aluno
                </Button>
              </>
            )}
          </div>
          {!participationOpen ? (
            <p className="text-xs text-[var(--text-muted)]">
              A campanha não está aberta para novas mensagens no momento. Você ainda pode ver as homenagens já publicadas
              abaixo.
            </p>
          ) : null}

          <p className="mt-4 text-sm leading-relaxed text-[var(--igh-muted)]">
            Cada cartão abaixo é uma mensagem enviada nesta campanha. Os nomes dos alunos aparecem de forma resumida para
            preservar a privacidade.
          </p>
        </div>

        {items.length === 0 ? (
          <p className="mb-6 text-center text-sm text-[var(--text-muted)]">
            Ainda não há mensagens publicadas aqui. Cadastre-se e envie a sua pelo painel do aluno.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((m) => (
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
                    onClick={() => void likeMessage(m)}
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
            {items.length > 9 ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="rounded-full border border-rose-200 bg-white/70 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/50 dark:bg-[var(--card-bg)] dark:text-rose-300"
                >
                  {showAll ? "Ver menos" : "Ver todas"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </Container>
    </Section>
  );
}
