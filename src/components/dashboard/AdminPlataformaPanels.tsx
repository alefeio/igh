import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  MessageCircle,
  PlayCircle,
  UserCheck,
  Users2,
} from "lucide-react";

import { DashboardForumActivityRail } from "@/components/dashboard/DashboardForumActivityRail";
import { DashboardStudentRanking } from "@/components/dashboard/DashboardStudentRanking";
import { PlatformExperienceSummarySection } from "@/components/dashboard/PlatformExperienceSummarySection";
import { SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import type {
  AdminPlataformaPagePayload,
  DashboardAccessActivitySummary,
  PlatformEngagementSnapshot,
} from "@/lib/dashboard-data";
import { formatDateTime } from "@/lib/format";

function PlatformEngagementDashboardGrid({ e }: { e: PlatformEngagementSnapshot }) {
  const exPct =
    e.exerciseAttemptsTotal > 0
      ? Math.round((e.exerciseCorrectTotal / e.exerciseAttemptsTotal) * 100)
      : null;
  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg bg-[var(--igh-surface)]/50 px-3 py-2.5 ring-1 ring-[var(--card-border)]/70">
        <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
          <PlayCircle className="h-3.5 w-3.5 text-[var(--igh-primary)]" aria-hidden />
          Aulas concluídas (total)
        </dt>
        <dd className="mt-1 text-lg font-bold tabular-nums text-[var(--text-primary)]">{e.lessonsCompletedTotal}</dd>
      </div>
      <div className="rounded-lg bg-[var(--igh-surface)]/50 px-3 py-2.5 ring-1 ring-[var(--card-border)]/70">
        <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
          <BookOpen className="h-3.5 w-3.5 text-[var(--igh-primary)]" aria-hidden />
          Registros de acesso a aulas
        </dt>
        <dd className="mt-1 text-lg font-bold tabular-nums text-[var(--text-primary)]">{e.lessonAccessRecordsTotal}</dd>
        <dd className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">
          Linhas de progresso (matrícula × aula com interação).
        </dd>
      </div>
      <div className="rounded-lg bg-[var(--igh-surface)]/50 px-3 py-2.5 ring-1 ring-[var(--card-border)]/70">
        <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
          <ClipboardList className="h-3.5 w-3.5 text-[var(--igh-primary)]" aria-hidden />
          Exercícios (alunos)
        </dt>
        <dd className="mt-1 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
          {e.exerciseCorrectTotal} acertos · {e.exerciseAttemptsTotal}{" "}
          {e.exerciseAttemptsTotal === 1 ? "tentativa" : "tentativas"}
          {exPct != null ? (
            <span className="ml-1.5 font-bold text-[var(--igh-primary)]">({exPct}%)</span>
          ) : null}
        </dd>
      </div>
      <div className="rounded-lg bg-[var(--igh-surface)]/50 px-3 py-2.5 ring-1 ring-[var(--card-border)]/70">
        <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
          <UserCheck className="h-3.5 w-3.5 text-[var(--igh-primary)]" aria-hidden />
          Presenças registradas
        </dt>
        <dd className="mt-1 text-lg font-bold tabular-nums text-[var(--text-primary)]">{e.attendancePresentTotal}</dd>
        <dd className="mt-0.5 text-[11px] text-[var(--text-muted)]">Sessões até hoje (fuso Brasil).</dd>
      </div>
      <div className="rounded-lg bg-[var(--igh-surface)]/50 px-3 py-2.5 ring-1 ring-[var(--card-border)]/70 sm:col-span-2 xl:col-span-2">
        <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
          <Users2 className="h-3.5 w-3.5 text-[var(--igh-primary)]" aria-hidden />
          Fórum
        </dt>
        <dd className="mt-1 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
          {e.forumQuestionsTotal} {e.forumQuestionsTotal === 1 ? "tópico" : "tópicos"} · {e.forumRepliesTotal}{" "}
          {e.forumRepliesTotal === 1 ? "resposta" : "respostas"}
        </dd>
        <dd className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
          Respostas entre alunos e comentários do professor ou da equipe.
        </dd>
      </div>
    </dl>
  );
}

function AdminAccessActivitySummarySection({ summary }: { summary: DashboardAccessActivitySummary }) {
  const hasAny = summary.recentLogins.length > 0 || summary.recentPageVisits.length > 0;

  return (
    <SectionCard
      title="Atividade e acessos"
      description="Últimos logins e últimas páginas na área logada. Horários em horário de Brasília. Rotas mais visitadas: relatório completo."
      id="admin-acessos-resumo-heading"
      dataTour="admin-plataforma-acessos-resumo"
      variant="elevated"
      className="flex h-full min-h-0 flex-col"
      contentClassName="flex min-h-0 flex-1 flex-col gap-5"
      action={
        <Link
          href="/master/acessos"
          className="text-sm font-semibold text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] rounded"
        >
          Relatório completo →
        </Link>
      }
    >
      {!hasAny ? (
        <p className="text-sm text-[var(--text-muted)]">
          Ainda não há logins nem visitas de página registados — ou o histórico começou recentemente.
        </p>
      ) : (
        <>
          {summary.recentLogins.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Últimos logins</p>
              <ul className="mt-2 space-y-2 text-sm">
                {summary.recentLogins.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-[var(--card-border)]/60 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="min-w-0 font-medium text-[var(--text-primary)]">{row.userName}</span>
                    <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-[var(--text-muted)]">
                      {formatDateTime(row.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary.recentPageVisits.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Últimas páginas</p>
              <ul className="mt-2 space-y-2 text-sm">
                {summary.recentPageVisits.map((row) => (
                  <li
                    key={row.id}
                    className="border-b border-[var(--card-border)]/60 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                      <span className="min-w-0 break-all font-mono text-xs text-[var(--text-primary)]">{row.path}</span>
                      <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-[var(--text-muted)]">
                        {formatDateTime(row.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{row.userName}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}

const rankingCardClass =
  "ring-2 ring-violet-500/40 shadow-xl dark:ring-violet-400/30 h-full min-h-0 flex flex-col";

export function AdminPlataformaPanels({ payload }: { payload: AdminPlataformaPagePayload }) {
  const {
    platformEngagement,
    teachersGamificationRanking,
    platformExperienceSummary,
    accessActivitySummary,
    forumLessonsWithActivity,
    studentRankingTop,
  } = payload;

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <section data-tour="admin-plataforma-engajamento" aria-label="Engajamento na plataforma">
        <SectionCard
          title="Engajamento na plataforma"
          description="Totais de estudo, frequência e fórum — mesma base do painel do aluno (matrículas ativas; presenças em sessões até hoje no fuso Brasil)."
          id="admin-engajamento-heading"
          variant="elevated"
        >
          <PlatformEngagementDashboardGrid e={platformEngagement} />
        </SectionCard>
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch" data-tour="admin-plataforma-rankings">
        <SectionCard
          title="Ranking dos professores"
          description="Top 10 por pontuação total: conteúdo, exercícios, frequência, fórum, horas assistidas e exercícios dos alunos."
          id="admin-ranking-professores-heading"
          variant="elevated"
          className={rankingCardClass}
          contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
          action={
            <Link
              href="/gamificacao"
              className="text-sm font-semibold text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] rounded"
            >
              Quadro completo →
            </Link>
          }
        >
          {teachersGamificationRanking.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhum professor ativo.</p>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
              <TableShell>
                <thead>
                  <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]/90 text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">#</th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Professor</th>
                    <th className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {teachersGamificationRanking.slice(0, 10).map((r, i) => (
                    <tr
                      key={r.teacherId}
                      className="border-b border-[var(--card-border)] transition hover:bg-[var(--igh-surface)]/40"
                    >
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{i + 1}</td>
                      <td className="px-4 py-3 text-sm font-normal text-[var(--text-muted)]">{r.teacherName}</td>
                      <td className="px-4 py-3 text-right text-lg font-bold tabular-nums text-[var(--igh-primary)]">
                        {r.points.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>
          )}
        </SectionCard>

        <div className="flex min-h-0 min-w-0 flex-col">
          <DashboardStudentRanking
            entries={studentRankingTop}
            prominent
            title="Ranking dos alunos"
            description="Os 7 primeiros no ranking geral de gamificação da plataforma."
            footerHint="Abre a lista completa com filtros e posições."
          />
        </div>
      </div>

      <PlatformExperienceSummarySection
        summary={platformExperienceSummary}
        href="/admin/avaliacoes-experiencia"
        title="Avaliações dos alunos"
        description="Médias de 1 a 10 (plataforma, aulas, professor) em todas as respostas registradas."
        className="flex h-full min-h-0 flex-col"
        contentClassName="flex flex-1 flex-col"
      />

      <DashboardForumActivityRail variant="admin" items={forumLessonsWithActivity} />

      <AdminAccessActivitySummarySection summary={accessActivitySummary} />
    </div>
  );
}
