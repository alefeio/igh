"use client";

import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  ListVideo,
  Lock,
  PlayCircle,
  Star,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DashboardTutorial, type TutorialStep } from "@/components/dashboard/DashboardTutorial";
import { QuickActionGrid, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import type { ApiResponse } from "@/lib/api-types";

type Lesson = {
  id: string;
  title: string;
  order: number;
  videoUrl: string | null;
  contentRich: string | null;
  imageUrls: string[];
  isLiberada: boolean;
  completed: boolean;
  lastContentPageIndex: number | null;
  /** Se false, a aula está bloqueada até concluir os exercícios da aula anterior. */
  previousLessonExercisesComplete?: boolean;
};

type Module = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessons: Lesson[];
};

type LessonStat = {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  moduleOrder: number;
  totalAttempts: number;
  correctAttempts: number;
  lastAttemptCorrect: boolean | null;
  ratio: number;
};

type ExerciseStats = {
  totalCorrect: number;
  totalAttempts: number;
  lessonStats: LessonStat[];
  topicsBem: LessonStat[];
  topicsAtencao: LessonStat[];
};

type CourseContentData = {
  courseName: string;
  courseImageUrl?: string | null;
  teacherName: string;
  teacherPhotoUrl: string | null;
  modules: Module[];
  exerciseStats?: ExerciseStats;
};

/** Bandeira quadriculada (chegada) — alinhada ao dashboard do aluno. */
function FinishLineFlagIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <path
        d="M4 22V3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-[var(--text-muted)]"
      />
      <g className="dark:invert">
        <rect x="6" y="4" width="16" height="12" rx="1" fill="#18181b" />
        <rect x="6" y="4" width="4" height="4" fill="#fafafa" />
        <rect x="14" y="4" width="4" height="4" fill="#fafafa" />
        <rect x="10" y="8" width="4" height="4" fill="#fafafa" />
        <rect x="18" y="8" width="4" height="4" fill="#fafafa" />
        <rect x="6" y="12" width="4" height="4" fill="#fafafa" />
        <rect x="14" y="12" width="4" height="4" fill="#fafafa" />
      </g>
    </svg>
  );
}

/** Bloco do professor no hero do conteúdo (foto + nome). */
function TeacherHeroCard({
  name,
  photoUrl,
  variant = "plain",
}: {
  name: string;
  photoUrl: string | null;
  /** overlay: sobre foto do curso; plain: quando não há imagem de capa */
  variant?: "overlay" | "plain";
}) {
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  const photo = photoUrl?.trim();

  const containerClass =
    variant === "overlay"
      ? "shrink-0"
      : "shrink-0 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 shadow-lg shadow-black/5 ring-1 ring-black/[0.03] backdrop-blur-sm sm:p-4 dark:ring-white/[0.06]";
  const labelClass =
    variant === "overlay"
      ? "text-[0.65rem] font-bold uppercase tracking-wider text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
      : "text-[0.65rem] font-bold uppercase tracking-wider text-[var(--text-muted)]";
  const nameClass =
    variant === "overlay"
      ? "mt-0.5 text-sm font-bold leading-snug text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:text-base"
      : "mt-0.5 text-sm font-bold leading-snug text-[var(--text-primary)] sm:text-base";

  return (
    <div className={containerClass}>
      <div className="flex flex-col items-center gap-2 sm:gap-3">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--card-bg)] ring-2 ring-[var(--igh-primary)]/25 sm:h-32 sm:w-32">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center bg-[var(--igh-surface)] text-2xl font-bold text-[var(--text-muted)] sm:text-3xl"
              aria-hidden
            >
              {initials}
            </span>
          )}
        </div>
        <div className="max-w-[10rem] text-center">
          <p className={labelClass}>Professor</p>
          <p className={nameClass}>{name}</p>
        </div>
      </div>
    </div>
  );
}

export default function ConteudoPage() {
  const params = useParams();
  const enrollmentId = params?.id as string;
  const toast = useToast();
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CourseContentData | null>(null);

  useEffect(() => {
    if (!enrollmentId) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/me/enrollments/${enrollmentId}/course-content`, {
          cache: "no-store",
        });
        const json = (await res.json()) as ApiResponse<CourseContentData>;
        if (res.ok && json?.ok) setData(json.data);
        else toast.push("error", json && "error" in json ? json.error.message : "Conteúdo não disponível ou ainda não liberado.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [enrollmentId, toast]);

  const tutorialSteps: TutorialStep[] = useMemo(() => {
    if (!data) return [];
    const steps: TutorialStep[] = [
      {
        target: "[data-tour=\"conteudo-voltar\"]",
        title: "Voltar à turma",
        content: "Use este link para retornar ao detalhe da matrícula e ver informações da turma.",
      },
      {
        target: "[data-tour=\"conteudo-foto-curso\"]",
        title: "Foto do curso",
        content: "Identificação visual do curso. Abaixo vêm seu progresso e os módulos.",
      },
      {
        target: "[data-tour=\"conteudo-header\"]",
        title: "Conteúdo do curso",
        content: "Aqui você vê o nome do curso e a lista de módulos e aulas. Clique em uma aula para abrir o conteúdo.",
      },
      {
        target: "[data-tour=\"conteudo-desempenho\"]",
        title: "Desempenho nos exercícios",
        content: "Seu desempenho nas questões ao final de cada aula aparece aqui. Você pode ver por aula e identificar o que precisa revisar.",
      },
      {
        target: "[data-tour=\"conteudo-modulos\"]",
        title: "Módulos e aulas",
        content: "Cada módulo agrupa as aulas do curso. Use \"Abrir conteúdo\" para assistir e marcar como concluída.",
      },
      {
        target: null,
        title: "Tudo pronto!",
        content: "Agora você já conhece esta tela. Escolha uma aula e clique em \"Abrir conteúdo\" para começar.",
      },
    ];
    if (data.modules.reduce((acc, m) => acc + m.lessons.length, 0) > 0) {
      steps.splice(1, 0, {
        target: "[data-tour=\"conteudo-progresso\"]",
        title: "Seu progresso",
        content: "Acompanhe quantas aulas você já concluiu e continue de onde parou com o botão de recomendação.",
      });
    }
    return steps;
  }, [data]);

  if (loading || !data) {
    return (
      <div className="flex min-w-0 flex-col gap-6 pb-8 pt-0">
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
            href={`/minhas-turmas/${enrollmentId}`}
          >
            <ArrowLeft className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
            Voltar à turma
          </Link>
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-10 text-center shadow-inner">
            <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-[var(--igh-primary)]/20" />
            <p className="text-sm font-medium text-[var(--text-muted)]">
              {loading ? "Carregando seu conteúdo…" : "Conteúdo não encontrado."}
            </p>
          </div>
        </div>
    );
  }

  const totalLessons = data.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedCount = data.modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.completed).length,
    0
  );

  /** Mapa lessonId → aula para obter lastContentPageIndex nos links da seção de exercícios. */
  const lessonById = new Map(data.modules.flatMap((m) => m.lessons.map((l) => [l.id, l])));
  /** Aulas na ordem do curso (para saber a aula anterior em cada uma). */
  const orderedLessonsList = data.modules.flatMap((m) => m.lessons);
  const prevLessonIdByLessonId = new Map<string, string>();
  orderedLessonsList.forEach((l, i) => {
    if (i > 0) prevLessonIdByLessonId.set(l.id, orderedLessonsList[i - 1]!.id);
  });

  const moduleInProgress = (() => {
    for (const mod of data.modules) {
      const hasIncomplete = mod.lessons.some((l) => l.isLiberada && !l.completed);
      if (hasIncomplete) return mod;
    }
    return null;
  })();
  const allCompleted = totalLessons > 0 && completedCount === totalLessons;

  const recommendedLesson = (() => {
    for (const mod of data.modules) {
      for (const lesson of mod.lessons) {
        if (lesson.isLiberada && !lesson.completed) return lesson;
      }
    }
    return null;
  })();

  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <div className="flex min-w-0 flex-col gap-8 pb-10 pt-1 sm:gap-10">
        <nav aria-label="Navegação">
          <Link
            data-tour="conteudo-voltar"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
            href={`/minhas-turmas/${enrollmentId}`}
          >
            <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
            Voltar à turma
          </Link>
        </nav>

        <section
          data-tour="conteudo-foto-curso"
          className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-lg shadow-black/[0.06] ring-1 ring-black/[0.03] dark:ring-white/[0.05]"
          aria-label={`Foto do curso ${data.courseName}`}
        >
          {data.courseImageUrl?.trim() ? (
            <div className="relative aspect-[21/9] min-h-[220px] max-h-80 w-full sm:min-h-[240px] sm:max-h-[22rem] sm:aspect-[2.5/1]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.courseImageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden />
              <div className="absolute bottom-0 left-0 right-0 flex flex-row items-end justify-between gap-4 p-4 sm:p-6">
                <div className="min-w-0 flex-1 pb-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">Seu curso</p>
                  <p className="mt-1 text-xl font-bold text-white drop-shadow-md sm:text-2xl">{data.courseName}</p>
                </div>
                <TeacherHeroCard name={data.teacherName} photoUrl={data.teacherPhotoUrl} variant="overlay" />
              </div>
            </div>
          ) : (
            <div className="relative flex min-h-[160px] flex-row items-center justify-between gap-6 overflow-hidden bg-gradient-to-br from-[var(--igh-primary)]/25 via-violet-500/10 to-[var(--igh-primary)]/5 px-5 py-10 sm:min-h-[180px] sm:px-8">
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--igh-primary)]/20 blur-3xl"
                aria-hidden
              />
              <div className="relative flex min-w-0 flex-1 flex-col items-start justify-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--card-bg)]/80 text-[var(--igh-primary)] shadow-md backdrop-blur-sm">
                  <BookOpen className="h-6 w-6" aria-hidden />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--igh-primary)]">Conteúdo</p>
                <p className="text-lg font-bold text-[var(--text-primary)] sm:text-xl">{data.courseName}</p>
                <p className="text-xs text-[var(--text-muted)]">Capa do curso ainda não foi cadastrada — o foco é no que você vai aprender.</p>
              </div>
              <TeacherHeroCard name={data.teacherName} photoUrl={data.teacherPhotoUrl} variant="plain" />
            </div>
          )}
        </section>

        {totalLessons > 0 && (
          <SectionCard
            dataTour="conteudo-progresso"
            title="Seu progresso neste curso"
            description="Cada aula concluída aproxima você da linha de chegada."
            id="progress-heading"
            variant="elevated"
          >
            <div className="flex flex-wrap items-center gap-3">
              {allCompleted ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Curso concluído
                </span>
              ) : moduleInProgress ? (
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-200">
                  Módulo {moduleInProgress.order + 1} em andamento
                </span>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap items-end gap-6">
              <div>
                <p className="text-5xl font-bold tabular-nums tracking-tight text-[var(--text-primary)]">{completedCount}</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
                  de <span className="font-bold text-[var(--text-primary)]">{totalLessons}</span>{" "}
                  {totalLessons === 1 ? "aula" : "aulas"}
                </p>
              </div>
              <div className="min-w-[200px] flex-1">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 shrink-0 text-[var(--igh-primary)]" aria-hidden />
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--igh-surface)] shadow-inner">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--igh-primary)] to-violet-500 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span
                    className="inline-flex shrink-0"
                    title="Chegada — fim do percurso do curso"
                    role="img"
                    aria-label="Chegada, linha de chegada do percurso"
                  >
                    <FinishLineFlagIcon className="h-5 w-5 text-[var(--igh-primary)]" />
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-[var(--igh-primary)]">{progressPct}% do percurso</p>
              </div>
            </div>
            {recommendedLesson && (
              <Link
                href={
                  recommendedLesson.lastContentPageIndex != null
                    ? `/minhas-turmas/${enrollmentId}/conteudo/aula/${recommendedLesson.id}?pagina=${recommendedLesson.lastContentPageIndex + 1}`
                    : `/minhas-turmas/${enrollmentId}/conteudo/aula/${recommendedLesson.id}`
                }
                className="group mt-6 flex flex-wrap items-center gap-4 rounded-2xl border-2 border-[var(--igh-primary)]/35 bg-gradient-to-r from-[var(--igh-primary)]/10 to-violet-500/10 p-4 transition hover:border-[var(--igh-primary)]/55 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:p-5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--igh-primary)] text-white shadow-lg shadow-[var(--igh-primary)]/30">
                  <PlayCircle className="h-6 w-6" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--igh-primary)]">
                    {completedCount > 0 ? "Continuar de onde parou" : "Começar agora"}
                  </p>
                  <p className="mt-0.5 font-bold text-[var(--text-primary)] group-hover:text-[var(--igh-primary)]">
                    {recommendedLesson.title}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[var(--igh-primary)] transition group-hover:translate-x-0.5" aria-hidden />
              </Link>
            )}
          </SectionCard>
        )}

        <SectionCard
          dataTour="conteudo-header"
          title={data.courseName}
          description={
            totalLessons === 0
              ? "Módulos e aulas aparecerão aqui quando estiverem cadastrados."
              : `${totalLessons} ${totalLessons === 1 ? "aula" : "aulas"} no programa${completedCount > 0 ? ` · ${completedCount} concluída${completedCount > 1 ? "s" : ""}` : ""}`
          }
          id="conteudo-curso-heading"
          variant="default"
          className="scroll-mt-4"
        >
          <div className="space-y-10">
          <SectionCard
            dataTour="conteudo-desempenho"
            title="Desempenho nos exercícios"
            description="Acertos e tentativas por aula — ideal para revisar antes de seguir em frente."
            id="desempenho-heading"
            variant="elevated"
            className="border-[var(--igh-primary)]/12 bg-gradient-to-br from-[var(--igh-surface)]/60 to-[var(--card-bg)]"
          >
            {(data.exerciseStats?.totalAttempts ?? 0) === 0 ? (
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                Responda às questões ao final das aulas para ver aqui seu desempenho geral, por aula e quais tópicos merecem uma segunda leitura.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-inner sm:p-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--igh-primary)]/25 to-violet-500/15 text-[var(--igh-primary)] shadow-sm">
                    <ClipboardList className="h-7 w-7" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Desempenho geral neste curso
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                      {data.exerciseStats?.totalCorrect ?? 0}
                      <span className="ml-1 text-base font-semibold text-[var(--text-muted)]">
                        / {data.exerciseStats?.totalAttempts ?? 0} acertos
                      </span>
                      <span className="ml-2 text-xl font-bold text-[var(--igh-primary)]">
                        (
                        {(data.exerciseStats?.totalAttempts ?? 0) > 0
                          ? Math.round(
                              ((data.exerciseStats?.totalCorrect ?? 0) / (data.exerciseStats?.totalAttempts ?? 1)) * 100
                            )
                          : 0}
                        %)
                      </span>
                    </p>
                  </div>
                  <Link
                    href={`/minhas-turmas/${enrollmentId}/exercicios`}
                    className="inline-flex items-center gap-1 rounded-xl bg-[var(--igh-primary)]/10 px-4 py-2 text-xs font-bold text-[var(--igh-primary)] transition hover:bg-[var(--igh-primary)]/20"
                  >
                    Ver por aula
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>

                {(data.exerciseStats?.lessonStats?.length ?? 0) > 0 && (
                  <div className="mt-6">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                      <ListVideo className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
                      Por aula
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {(data.exerciseStats?.lessonStats ?? [])
                        .slice()
                        .sort((a, b) => a.moduleOrder - b.moduleOrder || a.lessonTitle.localeCompare(b.lessonTitle))
                        .map((t) => {
                          const precisaRevisar = (data.exerciseStats?.topicsAtencao ?? []).some((a) => a.lessonId === t.lessonId);
                          const estaBem = (data.exerciseStats?.topicsBem ?? []).some((b) => b.lessonId === t.lessonId);
                          return (
                            <Link
                              key={t.lessonId}
                              href={
                                (() => {
                                  const lesson = lessonById.get(t.lessonId);
                                  return lesson?.lastContentPageIndex != null
                                    ? `/minhas-turmas/${enrollmentId}/conteudo/aula/${t.lessonId}?pagina=${lesson.lastContentPageIndex + 1}`
                                    : `/minhas-turmas/${enrollmentId}/conteudo/aula/${t.lessonId}`;
                                })()
                              }
                              className={`group flex flex-col rounded-2xl border p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                                precisaRevisar
                                  ? "border-amber-400/80 bg-amber-50/60 dark:border-amber-600 dark:bg-amber-950/25"
                                  : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--igh-primary)]/35"
                              }`}
                            >
                              <p className="line-clamp-2 font-medium text-[var(--text-primary)]">
                                {t.lessonTitle}
                              </p>
                              <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                                {t.correctAttempts}/{t.totalAttempts} acertos
                                <span className={estaBem ? " text-green-600 dark:text-green-400" : precisaRevisar ? " text-amber-600 dark:text-amber-400" : ""}>
                                  {" "}({Math.round(t.ratio * 100)}%)
                                </span>
                              </p>
                              {precisaRevisar && (
                                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  Revisar esta aula
                                </p>
                              )}
                              {estaBem && !precisaRevisar && (
                                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  Tópico em que você está bem
                                </p>
                              )}
                            </Link>
                          );
                        })}
                    </div>
                  </div>
                )}
              </>
            )}
          </SectionCard>

          {data.modules.length === 0 ? (
            <div
              className="rounded-2xl border-2 border-dashed border-[var(--igh-primary)]/25 bg-[var(--igh-surface)]/50 px-6 py-14 text-center shadow-inner"
              role="status"
            >
              <BookOpen className="mx-auto h-10 w-10 text-[var(--igh-primary)]/50" aria-hidden />
              <p className="mt-4 text-sm font-medium text-[var(--text-muted)]">
                Nenhum módulo cadastrado para este curso ainda. Volte em breve ou fale com a coordenação.
              </p>
            </div>
          ) : (
            data.modules.map((mod, modIndex) => (
              <section
                key={mod.id}
                data-tour={modIndex === 0 ? "conteudo-modulos" : undefined}
                className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] sm:p-6"
                aria-labelledby={`module-${mod.id}`}
              >
                <div className="border-b border-[var(--card-border)] pb-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--igh-primary)]">
                    Módulo {mod.order + 1}
                  </p>
                  <h2 id={`module-${mod.id}`} className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                    {mod.title}
                  </h2>
                  {mod.description && (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{mod.description}</p>
                  )}
                </div>
                <ul className="mt-2 list-none space-y-0 p-0" aria-label={`Aulas do módulo ${mod.title}`}>
                  {mod.lessons.map((lesson, index) => (
                    <li
                      key={lesson.id}
                      className={`flex flex-wrap items-center justify-between gap-4 py-4 ${
                        index < mod.lessons.length - 1 ? "border-b border-[var(--card-border)]" : ""
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--igh-surface)] text-xs font-bold tabular-nums text-[var(--text-muted)] ring-1 ring-[var(--card-border)]">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[var(--text-primary)]">{lesson.title}</span>
                            {lesson.completed && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" aria-hidden />
                                Concluída
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {lesson.isLiberada ? (
                        lesson.previousLessonExercisesComplete !== false ? (
                          <Link
                            href={
                              lesson.lastContentPageIndex != null
                                ? `/minhas-turmas/${enrollmentId}/conteudo/aula/${lesson.id}?pagina=${lesson.lastContentPageIndex + 1}`
                                : `/minhas-turmas/${enrollmentId}/conteudo/aula/${lesson.id}`
                            }
                            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--igh-primary)] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[var(--igh-primary)]/25 transition hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                          >
                            <PlayCircle className="h-4 w-4" aria-hidden />
                            Abrir conteúdo
                          </Link>
                        ) : (
                          <span className="flex max-w-md shrink-0 flex-col items-stretch gap-2 sm:items-end">
                            <span
                              className="rounded-xl border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                              role="status"
                            >
                              Conclua os exercícios da aula anterior para desbloquear esta aula.
                            </span>
                            {prevLessonIdByLessonId.get(lesson.id) && (
                              <Link
                                href={`/minhas-turmas/${enrollmentId}/conteudo/aula/${prevLessonIdByLessonId.get(lesson.id)}?secao=exercicios#secoes`}
                                className="text-right text-xs font-bold text-[var(--igh-primary)] hover:underline"
                              >
                                Ir aos exercícios da aula anterior →
                              </Link>
                            )}
                          </span>
                        )
                      ) : (
                        <span
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-1.5 text-xs font-bold text-[var(--text-muted)]"
                          aria-label="Aula ainda não liberada"
                        >
                          <Lock className="h-3.5 w-3.5" aria-hidden />
                          Em breve
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
          </div>
        </SectionCard>

        <section className="mt-2" aria-label="Acesso rápido neste curso">
          <h2 className="mb-1 text-lg font-bold text-[var(--text-primary)]">Atalhos úteis</h2>
          <p className="mb-4 text-sm text-[var(--text-muted)]">Navegue sem sair do fluxo de estudo.</p>
          <QuickActionGrid
            items={[
              {
                href: `/minhas-turmas/${enrollmentId}`,
                label: "Detalhe da turma",
                description: "Matrícula, dados e informações",
                icon: GraduationCap,
                accent: "from-slate-600 to-slate-800",
              },
              {
                href: `/minhas-turmas/${enrollmentId}/exercicios`,
                label: "Exercícios do curso",
                description: "Todas as questões desta matrícula",
                icon: Target,
                accent: "from-violet-500 to-purple-700",
              },
              {
                href: "/minhas-turmas/favoritos",
                label: "Favoritos",
                description: "Aulas salvas em qualquer curso",
                icon: Star,
                accent: "from-amber-500 to-orange-600",
              },
            ]}
          />
        </section>

      <DashboardTutorial
        showForStudent={user.role !== "MASTER"}
        steps={tutorialSteps}
        storageKey="minhas-turmas-conteudo-tutorial-done"
      />
    </div>
  );
}
