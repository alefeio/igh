import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CycleFilterSelect } from "@/components/dashboard/CycleFilterSelect";
import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { requireSessionUser } from "@/lib/auth";
import { getGamificationCycleContext } from "@/lib/gamification-cycle";
import { prisma } from "@/lib/prisma";
import {
  computeAllTeachersGamification,
  computeTeacherGamification,
  EXERCISES_TARGET_PER_LESSON,
  getGamificationRankingTableColumns,
} from "@/lib/teacher-gamification";

export const metadata = {
  title: "Gamificação — Professores",
};

type Props = { searchParams: Promise<{ cycleId?: string }> };

export default async function GamificacaoProfessoresPage({ searchParams }: Props) {
  const user = await requireSessionUser();
  if (user.role === "STUDENT") notFound();

  const { cycleId: cycleParam } = await searchParams;
  const { cycleId, cycles, selected } = await getGamificationCycleContext(cycleParam);

  const ranking = await computeAllTeachersGamification({ cycleId });
  let myTeacherId: string | null = null;
  if (user.role === "TEACHER") {
    const t = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    myTeacherId = t?.id ?? null;
  }

  const myStats = myTeacherId ? await computeTeacherGamification(myTeacherId, { cycleId }) : null;
  const rankingColumns = getGamificationRankingTableColumns();
  const cycleLabel = selected?.label ?? "ciclo atual";

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <nav aria-label="Navegação" className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5"
        >
          Dashboard · Gamificação
        </Link>
        <Suspense fallback={null}>
          <CycleFilterSelect cycles={cycles} selectedId={cycleId} />
        </Suspense>
      </nav>

      <DashboardHero
        eyebrow="Engajamento"
        title="Gamificação — professores"
        description={`Pontuação do ${cycleLabel}: conteúdo e exercícios nas aulas, frequência, fórum, horas de estudo dos alunos e exercícios realizados.`}
      />

      {myStats && (
        <SectionCard
          title="Seu desempenho"
          description={`Pontuação acumulada no ${cycleLabel}.`}
          variant="elevated"
          className="border-[var(--igh-primary)]/30 bg-[var(--igh-primary)]/5"
        >
          <p className="text-3xl font-bold tabular-nums text-[var(--text-primary)]">{myStats.points.total} pontos</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Resumo: {myStats.points.content} conteúdo · {myStats.points.exercises} exercícios (aula · meta{" "}
            {EXERCISES_TARGET_PER_LESSON}) · {myStats.points.attendance} frequência · {myStats.points.forum} fórum ·{" "}
            {myStats.points.studentWatchHours} h assistidas · {myStats.points.studentExerciseScore} exerc. realizados
          </p>
        </SectionCard>
      )}

      <SectionCard
        title="Ranking comparativo"
        description={`Professores ativos ordenados por pontuação no ${cycleLabel}. Passe o mouse nos títulos das colunas para dicas.`}
        variant="elevated"
      >
        <details className="mb-5 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/80 text-left">
          <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-bold text-[var(--igh-primary)] hover:underline">
            O que significa cada coluna?
          </summary>
          <dl className="space-y-2 border-t border-[var(--card-border)] px-3 py-3 text-xs text-[var(--text-secondary)]">
            {rankingColumns.map((col) => (
              <div key={col.label}>
                <dt className="font-semibold text-[var(--text-primary)]">{col.label}</dt>
                <dd className="mt-0.5 leading-relaxed text-[var(--text-muted)]">{col.description}</dd>
              </div>
            ))}
          </dl>
        </details>
        <TableShell aria-describedby="gamificacao-ranking-legend-hint">
          <caption id="gamificacao-ranking-legend-hint" className="sr-only">
            Passe o cursor sobre os títulos das colunas para uma dica rápida, ou abra &quot;O que significa cada
            coluna?&quot; acima para o texto completo.
          </caption>
          <thead>
            <tr className="border-b border-[var(--card-border)] text-left text-xs font-medium uppercase text-[var(--text-muted)]">
              {rankingColumns.map((col) => (
                <th
                  key={col.label}
                  scope="col"
                  title={col.description}
                  className={`px-3 py-2 ${col.align === "right" ? "text-right" : ""}`}
                >
                  <span className="border-b border-dotted border-[var(--text-muted)]/50 pb-px">{col.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranking.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  Nenhum professor ativo encontrado neste ciclo.
                </td>
              </tr>
            ) : (
              ranking.map((r, i) => (
                <tr
                  key={r.teacherId}
                  className={`border-b border-[var(--card-border)] ${
                    r.teacherId === myTeacherId ? "bg-[var(--igh-primary)]/10" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-[var(--text-secondary)]">{i + 1}</td>
                  <td className="px-3 py-2">
                    <span className="text-sm font-normal text-[var(--text-muted)]">{r.teacherName}</span>
                    {r.teacherId === myTeacherId && (
                      <span className="ml-2 text-xs font-semibold text-[var(--igh-primary)]">(você)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-[var(--text-primary)]">
                    {r.points.total}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{r.points.content}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{r.points.exercises}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{r.points.attendance}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{r.points.forum}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">
                    {r.points.studentWatchHours}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">
                    {r.points.studentExerciseScore}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      </SectionCard>
    </div>
  );
}
