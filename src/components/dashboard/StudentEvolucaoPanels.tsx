import Link from "next/link";
import { Award, ChevronRight, Flame, PlayCircle, Star, Trophy } from "lucide-react";

import { DashboardForumActivityRail } from "@/components/dashboard/DashboardForumActivityRail";
import { DashboardStudentRanking } from "@/components/dashboard/DashboardStudentRanking";
import { SectionCard } from "@/components/dashboard/DashboardUI";
import type { DashboardForumLessonActivity } from "@/lib/dashboard-forum-activity";
import type { DashboardDataStudent } from "@/lib/dashboard-data";
import {
  getAllUnlockedBadges,
  getLevel,
  getNextBadgePerTrack,
  POINTS_PER_LESSON,
  type StudentBadgeContext,
} from "@/lib/student-badge-definitions";
import { GAMIFICATION_POINTS } from "@/lib/teacher-gamification";
import type { StudentRankEntry } from "@/lib/student-gamification-ranking";

type Props = {
  metrics: DashboardDataStudent;
  studentRankingTop: StudentRankEntry[];
  myStudentRank: number | null;
  myStudentPoints: StudentRankEntry["points"] | null;
  forumLessonsWithActivity: DashboardForumLessonActivity[];
};

export function StudentEvolucaoPanels({
  metrics,
  studentRankingTop,
  myStudentRank,
  myStudentPoints,
  forumLessonsWithActivity,
}: Props) {
  const {
    enrollments,
    activeEnrollmentsCount,
    totalLessonsCompleted,
    totalLessonsTotal,
    totalExerciseCorrect,
    totalExerciseAttempts,
    totalAttendancePresent,
    totalForumQuestions,
    totalForumReplies,
  } = metrics;

  const pointsContent = totalLessonsCompleted * POINTS_PER_LESSON;
  const pointsExercises = totalExerciseAttempts + totalExerciseCorrect;
  const pointsFrequency = totalAttendancePresent * GAMIFICATION_POINTS.attendancePerPresentStudent;
  const pointsForum = (totalForumQuestions + totalForumReplies) * GAMIFICATION_POINTS.forumPerReply;
  const points = pointsContent + pointsExercises + pointsFrequency + pointsForum;
  const levelInfo = getLevel(points);
  const badgeContext: StudentBadgeContext = {
    total: totalLessonsTotal,
    completed: totalLessonsCompleted,
    enrollments,
    exerciseAttempts: totalExerciseAttempts,
    attendancePresent: totalAttendancePresent,
    forumInteractions: totalForumQuestions + totalForumReplies,
  };
  const conquistasRealizadas = getAllUnlockedBadges(badgeContext);
  const proximasMetasPorCategoria = getNextBadgePerTrack(badgeContext);

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <div className="flex min-h-0 flex-col">
          <SectionCard
            title="Sua evolução"
            description="Pontos, nível e conquistas — acompanhe sua jornada no IGH."
            id="gamificacao-heading"
            dataTour="dashboard-sua-evolucao"
            variant="elevated"
            className="border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-[var(--card-bg)] to-violet-50/30 ring-2 ring-amber-400/30 shadow-xl dark:border-amber-900/40 dark:from-amber-950/40 dark:via-[var(--card-bg)] dark:to-violet-950/20 dark:ring-amber-500/25"
            action={
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40"
                aria-hidden
              >
                <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </span>
            }
          >
            <div className="flex flex-wrap gap-8">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <Flame className="h-7 w-7 text-amber-700 dark:text-amber-300" aria-hidden />
                </div>
                <div>
                  <p className="text-3xl font-bold tabular-nums text-[var(--text-primary)]">{points}</p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--text-secondary)]">pontos</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Conteúdo {pointsContent} · Exercícios {pointsExercises} · Frequência {pointsFrequency} · Fórum{" "}
                    {pointsForum}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--igh-primary)]/15">
                  <Award className="h-7 w-7 text-[var(--igh-primary)]" aria-hidden />
                </div>
                <div>
                  <p className="text-xl font-bold text-[var(--text-primary)]">{levelInfo.name}</p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--text-secondary)]">nível atual</p>
                </div>
              </div>
            </div>
            {levelInfo.next && (
              <div className="mt-5">
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  Próximo: {levelInfo.next.name} ({levelInfo.next.min} pts)
                </p>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--igh-surface)]">
                  <div
                    className="h-full rounded-full bg-[var(--igh-primary)] transition-all"
                    style={{ width: `${Math.round(levelInfo.progressInLevel * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <div className="mt-6">
              <p className="text-base font-semibold text-[var(--text-primary)]">Conquistas</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Conquistas desbloqueadas e, em seguida, a próxima meta de cada categoria (borda tracejada).
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {conquistasRealizadas.length === 0 && proximasMetasPorCategoria.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">
                    Nenhuma conquista ainda. Conclua aulas, responda exercícios, participe das turmas e do fórum.
                  </p>
                ) : (
                  <>
                    {conquistasRealizadas.map((badge) => (
                      <span
                        key={badge.id}
                        title={`Conquista: ${badge.label}`}
                        className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-2 text-sm font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
                      >
                        <Star className="h-4 w-4 shrink-0 fill-amber-600 dark:fill-amber-400" aria-hidden />
                        {badge.label}
                      </span>
                    ))}
                    {proximasMetasPorCategoria.map((badge) => (
                      <span
                        key={`proximo-${badge.id}`}
                        title={`Próxima meta: ${badge.label}`}
                        className="inline-flex items-center gap-2 rounded-full border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-3.5 py-2 text-sm font-medium text-[var(--text-secondary)]"
                      >
                        <Star className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
                        {badge.label}
                      </span>
                    ))}
                  </>
                )}
              </div>
              {conquistasRealizadas.length > 0 && proximasMetasPorCategoria.length === 0 ? (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  Todas as metas desta lista foram atingidas nas categorias em que você participa.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </div>
        <div className="flex min-h-0 flex-col">
          <DashboardStudentRanking
            entries={studentRankingTop}
            myRank={myStudentRank}
            myPoints={myStudentPoints}
            showMotivation={activeEnrollmentsCount > 0}
            prominent
          />
        </div>
      </div>

      <SectionCard
        title="Desempenho nos exercícios"
        description="Acertos e revisão por tópico — use para reforçar o que ainda precisa de atenção."
        id="exercicios-heading"
        dataTour="dashboard-desempenho-exercicios"
        variant="elevated"
      >
        {totalExerciseAttempts > 0 ? (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-3xl font-bold tabular-nums text-[var(--text-primary)] sm:text-4xl">{totalExerciseCorrect}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                acertos em {totalExerciseAttempts} {totalExerciseAttempts === 1 ? "tentativa" : "tentativas"}
                <span className="ml-2 font-bold text-[var(--igh-primary)]">
                  {Math.round((totalExerciseCorrect / totalExerciseAttempts) * 100)}%
                </span>
              </p>
            </div>
            <Link
              href="/minhas-turmas"
              className="inline-flex items-center gap-1 text-sm font-bold text-[var(--igh-primary)] hover:underline"
            >
              Ver por curso e tópicos
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--text-muted)]">
            Responda às questões ao final das aulas para ver aqui seu desempenho e quais tópicos merecem uma segunda leitura.
          </p>
        )}
      </SectionCard>

      <DashboardForumActivityRail variant="student" items={forumLessonsWithActivity} />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/ranking-alunos"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40"
        >
          <PlayCircle className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
          Ver ranking completo
        </Link>
      </div>
    </div>
  );
}
