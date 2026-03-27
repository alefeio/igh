"use client";

import { useState } from "react";

import { TableShell } from "@/components/dashboard/DashboardUI";
import { Button } from "@/components/ui/Button";
import type { StudentRankEntry } from "@/lib/student-gamification-ranking";

export type RankingPlacementInfo =
  | { kind: "in_rank"; position: number; total: number; points: number }
  | { kind: "zero_points" }
  | { kind: "not_in_ranking" }
  | { kind: "not_student" };

const PAGE_SIZE = 50;

function PlacementBanner({ placement }: { placement: RankingPlacementInfo }) {
  if (placement.kind === "not_student") return null;

  const box =
    "mb-6 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-4 text-sm leading-relaxed text-[var(--text-primary)]";

  if (placement.kind === "in_rank") {
    return (
      <p className={box}>
        Sua colocação neste ranking: <strong className="text-[var(--igh-primary)]">{placement.position}º lugar</strong> entre{" "}
        <strong>{placement.total}</strong> alunos com pontuação ({placement.points} pontos).
      </p>
    );
  }

  if (placement.kind === "zero_points") {
    return (
      <p className={box}>
        Com <strong>0 pontos</strong>, você ainda não aparece nesta lista. Acumule pontos no painel (aulas, exercícios,
        frequência e fórum) para entrar no ranking.
      </p>
    );
  }

  return (
    <p className={box}>
      Você não consta neste ranking porque não há matrícula ativa ou ainda não há dados de pontuação associados à sua conta.
    </p>
  );
}

export function RankingAlunosFullTable({
  rows,
  viewerStudentId,
  placement,
  teacherHighlightStudentIds = null,
}: {
  rows: StudentRankEntry[];
  viewerStudentId: string | null;
  placement: RankingPlacementInfo;
  /** Quando o visitante é professor: IDs de alunos com matrícula ativa nas turmas dele. */
  teacherHighlightStudentIds?: readonly string[] | null;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = rows.slice(0, visible);
  const hasMore = visible < rows.length;

  const teacherSet =
    teacherHighlightStudentIds != null && teacherHighlightStudentIds.length > 0
      ? new Set(teacherHighlightStudentIds)
      : null;

  return (
    <>
      <PlacementBanner placement={placement} />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 text-center text-sm text-[var(--text-muted)]">
          Nenhum aluno com pontuação acima de zero no momento.
        </p>
      ) : (
        <>
          <TableShell>
            <thead>
              <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]/90 text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">#</th>
                <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Aluno</th>
                <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Nível</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const isViewer = viewerStudentId != null && r.studentId === viewerStudentId;
                const isTeacherStudent = teacherSet !== null && teacherSet.has(r.studentId);
                const highlightRow = isViewer || isTeacherStudent;
                return (
                  <tr
                    key={r.studentId}
                    className={
                      highlightRow
                        ? "border-b border-[var(--card-border)] bg-[var(--igh-primary)]/12 ring-2 ring-inset ring-[var(--igh-primary)]/35"
                        : "border-b border-[var(--card-border)] transition hover:bg-[var(--igh-surface)]/40"
                    }
                  >
                    <td className="px-4 py-3 tabular-nums text-[var(--text-secondary)]">{r.rank}</td>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      {r.displayName}
                      {isViewer ? (
                        <span className="ml-2 inline-block rounded-md bg-[var(--igh-primary)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--igh-primary)]">
                          Você
                        </span>
                      ) : isTeacherStudent ? (
                        <span className="ml-2 inline-block rounded-md bg-emerald-600/15 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          Meu aluno
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{r.levelName}</td>
                    <td className="px-4 py-3 text-right text-lg font-bold tabular-nums text-[var(--igh-primary)]">
                      {r.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>

          {hasMore ? (
            <div className="mt-6 flex justify-center">
              <Button type="button" variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Mostrar mais
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
