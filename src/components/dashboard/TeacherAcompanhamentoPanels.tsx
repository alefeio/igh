import type { ReactNode } from "react";
import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  Clock,
  ListChecks,
  MessageCircle,
  PlayCircle,
  Trophy,
  UserCheck,
  Users,
  Users2,
  ChevronRight,
} from "lucide-react";

import { DashboardForumActivityRail } from "@/components/dashboard/DashboardForumActivityRail";
import { DashboardStudentRanking } from "@/components/dashboard/DashboardStudentRanking";
import { PlatformExperienceSummarySection } from "@/components/dashboard/PlatformExperienceSummarySection";
import { SectionCard } from "@/components/dashboard/DashboardUI";
import type {
  TeacherAcompanhamentoPagePayload,
  TeacherClassGroupEngagement,
} from "@/lib/dashboard-data";
import type { TeacherGamificationResult } from "@/lib/teacher-gamification";
import { EXERCISES_TARGET_PER_LESSON } from "@/lib/teacher-gamification";

function TeacherGamificationPanel({ g }: { g: TeacherGamificationResult }) {
  const p = g.points;
  const cards: {
    title: string;
    value: number;
    unit: string;
    icon: ReactNode;
    accent: string;
  }[] = [
    {
      title: "Conteúdo nas aulas",
      value: p.content,
      unit: "pts",
      icon: <BookOpen className="h-5 w-5" aria-hidden />,
      accent: "from-amber-500/20 to-orange-500/10 text-amber-700 dark:text-amber-300",
    },
    {
      title: `Exercícios nas aulas (${EXERCISES_TARGET_PER_LESSON})`,
      value: p.exercises,
      unit: "pts",
      icon: <ClipboardList className="h-5 w-5" aria-hidden />,
      accent: "from-violet-500/20 to-purple-500/10 text-violet-700 dark:text-violet-300",
    },
    {
      title: "Frequência dos alunos",
      value: p.attendance,
      unit: "pts",
      icon: <Users className="h-5 w-5" aria-hidden />,
      accent: "from-emerald-500/20 to-teal-500/10 text-emerald-700 dark:text-emerald-300",
    },
    {
      title: "Participações nos fóruns (prof. e alunos)",
      value: p.forum,
      unit: "pts",
      icon: <MessageCircle className="h-5 w-5" aria-hidden />,
      accent: "from-sky-500/20 to-blue-500/10 text-sky-700 dark:text-sky-300",
    },
    {
      title: "Aulas assistidas",
      value: p.studentWatchHours,
      unit: "horas",
      icon: <Clock className="h-5 w-5" aria-hidden />,
      accent: "from-rose-500/20 to-pink-500/10 text-rose-700 dark:text-rose-300",
    },
    {
      title: "Exercícios realizados",
      value: p.studentExerciseScore,
      unit: "pts",
      icon: <ListChecks className="h-5 w-5" aria-hidden />,
      accent: "from-indigo-500/20 to-violet-500/10 text-indigo-700 dark:text-indigo-300",
    },
  ];

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/90 via-[var(--card-bg)] to-violet-50/40 p-5 shadow-sm dark:border-amber-900/40 dark:from-amber-950/35 dark:via-[var(--card-bg)] dark:to-violet-950/25 sm:p-6"
      data-tour="teacher-gamification"
      aria-labelledby="teacher-gamification-heading"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl dark:bg-amber-500/10"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="teacher-gamification-heading"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/25">
              <Trophy className="h-5 w-5" aria-hidden />
            </span>
            Sua gamificação
          </h2>
          <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">{p.total}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Pontuação total</p>
        </div>
        <Link
          href="/gamificacao"
          className="shrink-0 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]/80 px-4 py-2 text-sm font-medium text-[var(--igh-primary)] shadow-sm backdrop-blur-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
        >
          Ranking completo →
        </Link>
      </div>

      <ul className="relative mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <li
            key={c.title}
            className="group rounded-xl border border-[var(--card-border)]/80 bg-[var(--card-bg)]/70 p-4 shadow-sm backdrop-blur-md transition duration-200 hover:border-amber-300/50 hover:shadow-md dark:border-white/10 dark:bg-black/20 dark:hover:border-amber-700/40"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 text-xs font-semibold uppercase leading-snug tracking-wide text-[var(--text-muted)]">
                {c.title}
              </h3>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${c.accent}`}
              >
                {c.icon}
              </div>
            </div>
            <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">{c.value}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]/90">{c.unit}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TeacherClassGroupEngagementRows({ rows }: { rows: TeacherClassGroupEngagement[] }) {
  const sorted = [...rows].sort((a, b) =>
    a.courseName.localeCompare(b.courseName, "pt-BR", { sensitivity: "base" })
  );
  if (sorted.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">Nenhuma turma ativa no momento.</p>;
  }
  return (
    <ul className="flex flex-col gap-3" aria-label="Engajamento por turma">
      {sorted.map((r) => {
        const exPct =
          r.exerciseAttempts > 0 ? Math.round((r.exerciseCorrect / r.exerciseAttempts) * 100) : null;
        const cap =
          r.lessonsInCourse > 0 && r.enrollmentsCount > 0
            ? Math.round(
                (r.lessonsCompletedSum / (r.lessonsInCourse * r.enrollmentsCount)) * 100
              )
            : null;
        return (
          <li
            key={r.classGroupId}
            className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/35 p-4 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.03]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 gap-y-2">
              <div className="min-w-0">
                <p className="font-semibold leading-snug text-[var(--text-primary)]">{r.courseName}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {r.enrollmentsCount} {r.enrollmentsCount === 1 ? "aluno matriculado" : "alunos matriculados"}
                  {r.lessonsInCourse > 0 ? ` · ${r.lessonsInCourse} aulas no curso` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  href={`/professor/turmas/${r.classGroupId}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--igh-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                >
                  Painel da turma
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
                <Link
                  href={`/professor/forum/${r.courseId}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--igh-primary)]/40 hover:text-[var(--igh-primary)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                  Fórum do curso
                </Link>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-lg bg-[var(--card-bg)]/80 px-3 py-2.5 ring-1 ring-[var(--card-border)]/60">
                <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  <PlayCircle className="h-3.5 w-3.5 text-[var(--igh-primary)]" aria-hidden />
                  Aulas concluídas (soma)
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {r.lessonsCompletedSum}
                  {cap != null && !Number.isNaN(cap) ? (
                    <span className="ml-1.5 text-[var(--igh-primary)]">(~{cap}% do máx. teórico)</span>
                  ) : null}
                </dd>
              </div>
              <div className="rounded-lg bg-[var(--card-bg)]/80 px-3 py-2.5 ring-1 ring-[var(--card-border)]/60">
                <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  <BookOpen className="h-3.5 w-3.5 text-[var(--igh-primary)]" aria-hidden />
                  Acessos ao conteúdo
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {r.lessonAccessRecords}{" "}
                  <span className="font-normal text-[var(--text-muted)]">registros de progresso</span>
                </dd>
              </div>
              <div className="rounded-lg bg-[var(--card-bg)]/80 px-3 py-2.5 ring-1 ring-[var(--card-border)]/60">
                <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  <ClipboardList className="h-3.5 w-3.5 text-[var(--igh-primary)]" aria-hidden />
                  Exercícios
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {r.exerciseAttempts > 0 ? (
                    <>
                      {r.exerciseCorrect} acertos · {r.exerciseAttempts}{" "}
                      {r.exerciseAttempts === 1 ? "tentativa" : "tentativas"}
                      {exPct != null ? (
                        <span className="ml-1.5 font-bold text-[var(--igh-primary)]">({exPct}%)</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="font-normal text-[var(--text-muted)]">Nenhuma tentativa ainda</span>
                  )}
                </dd>
              </div>
              <div className="rounded-lg bg-[var(--card-bg)]/80 px-3 py-2.5 ring-1 ring-[var(--card-border)]/60">
                <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  <UserCheck className="h-3.5 w-3.5 text-[var(--igh-primary)]" aria-hidden />
                  Frequência
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {r.attendancePresent}{" "}
                  <span className="font-normal text-[var(--text-muted)]">
                    {r.attendancePresent === 1 ? "presença" : "presenças"}
                  </span>
                </dd>
              </div>
              <div className="rounded-lg bg-[var(--card-bg)]/80 px-3 py-2.5 ring-1 ring-[var(--card-border)]/60 sm:col-span-2 xl:col-span-1">
                <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  <Users2 className="h-3.5 w-3.5 text-[var(--igh-primary)]" aria-hidden />
                  Fórum (alunos)
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {r.forumQuestions} {r.forumQuestions === 1 ? "tópico" : "tópicos"} · {r.forumReplies}{" "}
                  {r.forumReplies === 1 ? "resposta" : "respostas"}
                </dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

export function TeacherAcompanhamentoPanels({ payload }: { payload: TeacherAcompanhamentoPagePayload }) {
  const {
    gamification,
    platformExperienceSummary,
    forumLessonsWithActivity,
    studentRankingTop,
    teacherClassGroupStats,
  } = payload;

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <div className="min-w-0">
        {gamification ? (
          <TeacherGamificationPanel g={gamification} />
        ) : (
          <SectionCard
            title="Gamificação"
            description="Pontuação por turmas, conteúdo e engajamento."
            variant="elevated"
          >
            <p className="text-sm text-[var(--text-muted)]">
              Quando houver dados de turmas, sua pontuação aparecerá aqui e na página de gamificação.
            </p>
          </SectionCard>
        )}
      </div>

      <section data-tour="teacher-dashboard-por-turma" aria-label="Engajamento por turma">
        <SectionCard
          title="Engajamento por turma"
          description="Soma do que os alunos fazem em cada turma: aulas concluídas e acessos, exercícios, frequência e participação no fórum."
          id="teacher-por-turma-heading"
          variant="elevated"
        >
          <TeacherClassGroupEngagementRows rows={teacherClassGroupStats} />
        </SectionCard>
      </section>

      <div className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
          <div className="flex min-h-0 min-w-0 flex-col">
            <DashboardStudentRanking
              entries={studentRankingTop}
              prominent
              title="Ranking dos meus alunos"
              description="Os 10 melhores entre os alunos das suas turmas; a posição exibida é a colocação no ranking geral da plataforma."
              footerHint="Abre o ranking geral de todos os alunos da plataforma."
            />
          </div>

          <PlatformExperienceSummarySection
            summary={platformExperienceSummary}
            href="/professor/avaliacoes-experiencia"
            title="Avaliações dos meus alunos"
            description="Apenas alunos com matrícula ativa em turmas suas. Inclui notas e comentários quando enviados."
            className="flex h-full min-h-0 flex-col"
            contentClassName="flex flex-1 flex-col"
          />
        </div>
      </div>

      <DashboardForumActivityRail variant="teacher" items={forumLessonsWithActivity} />
    </div>
  );
}
