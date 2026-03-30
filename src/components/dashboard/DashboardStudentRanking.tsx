"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, PartyPopper } from "lucide-react";

import type { StudentRankEntry } from "@/lib/student-ranking-shared";
import { SectionCard } from "@/components/dashboard/DashboardUI";
import {
  StudentRankingPointsBreakdownModal,
  StudentRankingPointsHelpModal,
} from "@/components/dashboard/StudentRankingPointsBreakdownModal";

export function DashboardStudentRanking({
  entries,
  myRank,
  myPoints,
  showMotivation = true,
  prominent = false,
  fullRankingHref = "/ranking-alunos",
  title = "Ranking dos alunos",
  description = "Mesma pontuação do seu painel: aulas, exercícios, presença e fórum. Bora competir com respeito e celebrar quem tá mandando bem! 🏆",
  footerHint = "Abre a lista completa com todos os alunos e posições.",
}: {
  entries: readonly StudentRankEntry[];
  /** Só preenchido no painel do aluno. */
  myRank?: number | null;
  myPoints?: number | null;
  /** Texto extra no topo (aluno). */
  showMotivation?: boolean;
  /** Destaque visual (ex.: topo do dashboard ao lado de “Sua evolução”). */
  prominent?: boolean;
  /** Página com a tabela completa do ranking. */
  fullRankingHref?: string;
  /** Título do card (ex.: professor: “Ranking dos meus alunos”). */
  title?: string;
  /** Descrição abaixo do título. */
  description?: string;
  /** Texto auxiliar abaixo do link “Ver ranking completo”. */
  footerHint?: string;
}) {
  const [detailEntry, setDetailEntry] = useState<StudentRankEntry | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const highlight =
    prominent
      ? "ring-2 ring-violet-500/40 shadow-xl dark:ring-violet-400/30 h-full min-h-0 flex flex-col"
      : "";

  const footerLink = (
    <div className="mt-4 border-t border-[var(--card-border)] pt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={fullRankingHref}
          className="inline-flex items-center gap-1 text-sm font-bold text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
        >
          Ver ranking completo
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="text-sm font-semibold text-[var(--text-secondary)] underline decoration-dotted underline-offset-2 hover:text-[var(--igh-primary)]"
        >
          Como a pontuação é calculada
        </button>
      </div>
      <p className="mt-1.5 text-xs text-[var(--text-muted)]">{footerHint}</p>
    </div>
  );

  const contentFlex = prominent ? "flex min-h-0 flex-1 flex-col gap-4" : "";

  if (entries.length === 0) {
    return (
      <>
        <SectionCard
          title={title}
          description="Ainda não há pontos acumulados — quando a galera começar a somar aulas e desafios, o pódio aparece aqui."
          id="dashboard-student-ranking-heading"
          className={highlight}
          contentClassName={contentFlex}
        >
          <p className="text-sm text-[var(--text-muted)]">Nenhum aluno com matrícula ativa no ranking ainda.</p>
          {footerLink}
        </SectionCard>
        <StudentRankingPointsHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      </>
    );
  }

  return (
    <>
      <SectionCard
        title={title}
        description={description}
        id="dashboard-student-ranking-heading"
        variant="elevated"
        className={highlight}
        contentClassName={contentFlex}
      >
        {showMotivation && myRank != null && myPoints != null && (
          <div className="shrink-0 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--igh-primary)]/30 bg-gradient-to-r from-[var(--igh-primary)]/10 to-violet-500/10 px-4 py-3 text-sm">
            <PartyPopper className="h-5 w-5 shrink-0 text-[var(--igh-primary)]" aria-hidden />
            <p className="font-semibold text-[var(--text-primary)]">
              Você está na{" "}
              <span className="text-[var(--igh-primary)]">
                {myRank}ª posição
              </span>{" "}
              com <span className="tabular-nums font-bold">{myPoints} pts</span>. Continue firme — dá pra subir! 🎯
            </p>
          </div>
        )}

        <ul
          className={
            prominent
              ? "min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]"
              : "space-y-2"
          }
        >
          {entries.map((r) => {
            const position = r.globalRank ?? r.rank;
            const isViewerRow = Boolean(r.isViewerOutOfTop9);
            return (
              <li
                key={`${r.studentId}-${r.rank}-${isViewerRow ? "viewer-slot" : "std"}`}
                className={
                  isViewerRow
                    ? "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--igh-primary)]/12 px-3 py-2.5 text-sm ring-2 ring-inset ring-[var(--igh-primary)]/35"
                    : "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/50 px-3 py-2.5 text-sm"
                }
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-700 dark:text-amber-300">
                    {position <= 3 ? (position === 1 ? "🥇" : position === 2 ? "🥈" : "🥉") : position}
                  </span>
                  <span className="truncate font-medium text-[var(--text-primary)]">{r.displayName}</span>
                  {isViewerRow ? (
                    <span className="shrink-0 rounded-md bg-[var(--igh-primary)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--igh-primary)]">
                      Você
                    </span>
                  ) : (
                    <span className="hidden text-xs text-[var(--text-muted)] sm:inline">· {r.levelName}</span>
                  )}
                </span>
                <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <span className="font-bold tabular-nums text-[var(--igh-primary)]">{r.points} pts</span>
                  <button
                    type="button"
                    onClick={() => setDetailEntry(r)}
                    className="text-xs font-semibold text-[var(--igh-primary)] underline underline-offset-2 hover:text-[var(--igh-primary)]/90"
                  >
                    Ver detalhes da pontuação
                  </button>
                </span>
              </li>
            );
          })}
        </ul>

        <div className="shrink-0">{footerLink}</div>
      </SectionCard>

      <StudentRankingPointsBreakdownModal
        entry={detailEntry}
        open={detailEntry != null}
        onClose={() => setDetailEntry(null)}
      />
      <StudentRankingPointsHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
