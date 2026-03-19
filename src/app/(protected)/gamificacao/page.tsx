import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSessionUser } from "@/lib/auth";
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

export default async function GamificacaoProfessoresPage() {
  const user = await requireSessionUser();
  if (user.role === "STUDENT") notFound();

  const ranking = await computeAllTeachersGamification();
  let myTeacherId: string | null = null;
  if (user.role === "TEACHER") {
    const t = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    myTeacherId = t?.id ?? null;
  }

  const myStats = myTeacherId ? await computeTeacherGamification(myTeacherId) : null;
  const rankingColumns = getGamificationRankingTableColumns();

  return (
    <div className="container-page flex flex-col gap-8">
      <header>
        <Link href="/dashboard" className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Voltar ao dashboard
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          Gamificação — professores
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">
          Pontuação baseada em: conteúdo nas aulas, {EXERCISES_TARGET_PER_LESSON} exercícios válidos por aula,
          frequência completa em sessões já realizadas, respostas suas no fórum de dúvidas e engajamento dos alunos
          (acesso ao conteúdo e tentativas nos exercícios).
        </p>
      </header>

      {myStats && (
        <section className="rounded-xl border border-[var(--igh-primary)]/40 bg-[var(--igh-primary)]/5 p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--igh-primary)]">Seu desempenho</h2>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{myStats.points.total} pontos</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Aulas com conteúdo: {myStats.totals.lessonsWithContent}/{myStats.totals.lessonsTotal} · Com{" "}
            {EXERCISES_TARGET_PER_LESSON} exercícios: {myStats.totals.lessonsWithFiveExercises} · Frequência OK:{" "}
            {myStats.totals.pastSessionsAttendanceComplete}/{myStats.totals.pastSessionsTotal} sessões passadas ·
            Participação no fórum: {myStats.totals.teacherRepliesInScope + myStats.totals.studentRepliesInScope}{" "}
            (prof: {myStats.totals.teacherRepliesInScope}, alunos: {myStats.totals.studentRepliesInScope})
          </p>
        </section>
      )}

      <section className="overflow-x-auto rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
        <div className="border-b border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Ranking comparativo</h2>
          <details className="mt-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-left">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-[var(--igh-primary)] hover:underline">
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
        </div>
        <table className="min-w-full text-sm" aria-describedby="gamificacao-ranking-legend-hint">
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
                <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  Nenhum professor ativo encontrado.
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
                  <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                    {r.teacherName}
                    {r.teacherId === myTeacherId && (
                      <span className="ml-2 text-xs font-normal text-[var(--igh-primary)]">(você)</span>
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
                    {r.points.studentEngagement}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
