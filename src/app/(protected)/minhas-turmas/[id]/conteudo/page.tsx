"use client";

import { BookOpen, AlertCircle, CheckCircle2, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DashboardTutorial, type TutorialStep } from "@/components/dashboard/DashboardTutorial";
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
      : "shrink-0 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-black/10 sm:p-4 dark:bg-white dark:ring-black/20";
  const labelClass =
    variant === "overlay"
      ? "text-[0.65rem] font-semibold uppercase tracking-wider text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
      : "text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500";
  const nameClass =
    variant === "overlay"
      ? "mt-0.5 text-sm font-semibold leading-snug text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:text-base"
      : "mt-0.5 text-sm font-semibold leading-snug text-zinc-900 sm:text-base";

  return (
    <div className={containerClass}>
      <div className="flex flex-col items-center gap-2 sm:gap-3">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-zinc-200 sm:h-36 sm:w-36">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center bg-zinc-100 text-2xl font-bold text-zinc-500 sm:text-3xl"
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
      <div className="container-page flex flex-col gap-6">
        <Link
          className="text-sm text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
          href={`/minhas-turmas/${enrollmentId}`}
        >
          ← Voltar à turma
        </Link>
        <div className="card">
          <div className="card-body py-10 text-center text-[var(--text-secondary)]">
            {loading ? "Carregando conteúdo do curso..." : "Conteúdo não encontrado."}
          </div>
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

  return (
    <div className="container-page flex flex-col gap-6">
      <nav aria-label="Navegação">
        <Link
          data-tour="conteudo-voltar"
          className="text-sm text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
          href={`/minhas-turmas/${enrollmentId}`}
        >
          ← Voltar à turma
        </Link>
      </nav>

      <section
        data-tour="conteudo-foto-curso"
        className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm"
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
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" aria-hidden />
            <div className="absolute bottom-0 left-0 right-0 flex flex-row items-end justify-between gap-4 p-4 sm:p-5">
              <p className="min-w-0 flex-1 pb-1 text-lg font-semibold text-white drop-shadow-md sm:text-xl">
                {data.courseName}
              </p>
              <TeacherHeroCard name={data.teacherName} photoUrl={data.teacherPhotoUrl} variant="overlay" />
            </div>
          </div>
        ) : (
          <div className="flex min-h-[140px] flex-row items-center justify-between gap-4 bg-gradient-to-br from-[var(--igh-primary)]/20 to-[var(--igh-primary)]/5 px-4 py-8 sm:min-h-[160px]">
            <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-2">
              <BookOpen className="h-10 w-10 text-[var(--igh-primary)] opacity-80" aria-hidden />
              <p className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">{data.courseName}</p>
              <p className="text-xs text-[var(--text-muted)]">Imagem do curso não cadastrada</p>
            </div>
            <TeacherHeroCard name={data.teacherName} photoUrl={data.teacherPhotoUrl} variant="plain" />
          </div>
        )}
      </section>

      {/* Seu progresso — sempre com dados do course-content (nunca falha) */}
      {totalLessons > 0 && (
        <section
          data-tour="conteudo-progresso"
          className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4 sm:p-5"
          aria-labelledby="progress-heading"
        >
          <h2 id="progress-heading" className="text-base font-semibold text-[var(--text-primary)]">
            Seu progresso
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-[var(--text-primary)]">
              <BookOpen className="h-5 w-5 shrink-0 text-[var(--igh-primary)]" aria-hidden />
              <span className="text-sm font-medium">
                <span className="font-semibold text-[var(--igh-primary)]">{completedCount}</span> de{" "}
                <span className="font-semibold">{totalLessons}</span> {totalLessons === 1 ? "aula concluída" : "aulas concluídas"}
              </span>
            </div>
            {allCompleted ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                Curso concluído
              </span>
            ) : moduleInProgress ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Módulo {moduleInProgress.order + 1} em andamento
              </span>
            ) : null}
          </div>
          {totalLessons > 0 && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--card-border)]">
              <div
                className="h-full rounded-full bg-[var(--igh-primary)] transition-all"
                style={{ width: `${(completedCount / totalLessons) * 100}%` }}
              />
            </div>
          )}
          {recommendedLesson && (
            <div className="mt-4">
              <Link
                href={
                  recommendedLesson.lastContentPageIndex != null
                    ? `/minhas-turmas/${enrollmentId}/conteudo/aula/${recommendedLesson.id}?pagina=${recommendedLesson.lastContentPageIndex + 1}`
                    : `/minhas-turmas/${enrollmentId}/conteudo/aula/${recommendedLesson.id}`
                }
                className="inline-flex items-center rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              >
                {completedCount > 0
                  ? `Continuar de onde parou: ${recommendedLesson.title}`
                  : "Inicie sua jornada"}
              </Link>
            </div>
          )}
        </section>
      )}

      <div className="card">
        <header className="card-header" data-tour="conteudo-header">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            {data.courseName}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {totalLessons === 0
              ? "Módulos e aulas do curso"
              : `${totalLessons} ${totalLessons === 1 ? "aula" : "aulas"}${completedCount > 0 ? ` · ${completedCount} concluída${completedCount > 1 ? "s" : ""}` : ""}`}
          </p>
        </header>
        <div className="card-body space-y-8">
          {/* Desempenho nos exercícios — dados vêm do course-content (uma única requisição) */}
          <section
            data-tour="conteudo-desempenho"
            className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4 sm:p-5"
            aria-labelledby="desempenho-heading"
          >
            <h2 id="desempenho-heading" className="text-base font-semibold text-[var(--text-primary)]">
              Desempenho nos exercícios
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Com base nos acertos e erros das questões por aula.
            </p>

            {(data.exerciseStats?.totalAttempts ?? 0) === 0 ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                Você ainda não respondeu exercícios neste curso. Responda às questões ao final das aulas para ver aqui seu desempenho geral e por aula.
              </p>
            ) : (
              <>
                {/* Card: desempenho geral */}
                <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--igh-primary)]/15 text-[var(--igh-primary)]">
                    <ClipboardList className="h-6 w-6" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      Desempenho geral
                    </p>
                    <p className="text-xl font-bold text-[var(--text-primary)]">
                      {data.exerciseStats?.totalCorrect ?? 0}
                      <span className="ml-1 text-base font-normal text-[var(--text-muted)]">
                        / {data.exerciseStats?.totalAttempts ?? 0} acertos
                      </span>
                      <span className="ml-2 text-lg font-semibold text-[var(--igh-primary)]">
                        ({((data.exerciseStats?.totalAttempts ?? 0) > 0 ? Math.round(((data.exerciseStats?.totalCorrect ?? 0) / (data.exerciseStats?.totalAttempts ?? 1)) * 100) : 0)}%)
                      </span>
                    </p>
                  </div>
                  <div className="ml-auto">
                    <Link
                      href={`/minhas-turmas/${enrollmentId}/exercicios`}
                      className="text-xs font-medium text-[var(--igh-primary)] underline hover:no-underline"
                    >
                      Ver respostas por aula
                    </Link>
                  </div>
                </div>

                {/* Cards menores: desempenho por aula */}
                {(data.exerciseStats?.lessonStats?.length ?? 0) > 0 && (
                  <div className="mt-4">
                    <h3 className="mb-3 text-sm font-medium text-[var(--text-primary)]">
                      Por aula
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                              className={`flex flex-col rounded-lg border p-3 text-left transition hover:border-[var(--igh-primary)]/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                                precisaRevisar
                                  ? "border-amber-400 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/20"
                                  : "border-[var(--card-border)] bg-[var(--card-bg)]"
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
          </section>

          {data.modules.length === 0 ? (
            <div
              className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-10 text-center"
              role="status"
            >
              <p className="text-sm text-[var(--text-muted)]">
                Nenhum módulo cadastrado para este curso ainda.
              </p>
            </div>
          ) : (
            data.modules.map((mod, modIndex) => (
              <section
                key={mod.id}
                data-tour={modIndex === 0 ? "conteudo-modulos" : undefined}
                className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4 sm:p-5"
                aria-labelledby={`module-${mod.id}`}
              >
                <h2 id={`module-${mod.id}`} className="text-base font-semibold text-[var(--text-primary)]">
                  {mod.title}
                </h2>
                {mod.description && (
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                    {mod.description}
                  </p>
                )}
                <ul className="mt-4 list-none space-y-0 p-0" aria-label={`Aulas do módulo ${mod.title}`}>
                  {mod.lessons.map((lesson, index) => (
                    <li
                      key={lesson.id}
                      className={`flex flex-wrap items-center justify-between gap-3 py-3 ${
                        index < mod.lessons.length - 1
                          ? "border-b border-[var(--card-border)]"
                          : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1 font-medium text-[var(--text-primary)]">
                        {lesson.title}
                        {lesson.completed && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                            Concluída
                          </span>
                        )}
                      </span>
                      {lesson.isLiberada ? (
                        lesson.previousLessonExercisesComplete !== false ? (
                          <Link
                            href={
                              lesson.lastContentPageIndex != null
                                ? `/minhas-turmas/${enrollmentId}/conteudo/aula/${lesson.id}?pagina=${lesson.lastContentPageIndex + 1}`
                                : `/minhas-turmas/${enrollmentId}/conteudo/aula/${lesson.id}`
                            }
                            className="shrink-0 rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                          >
                            Abrir conteúdo
                          </Link>
                        ) : (
                          <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                            <span
                              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                              role="status"
                            >
                              Resolva os exercícios da aula anterior para acessar esta aula
                            </span>
                            {prevLessonIdByLessonId.get(lesson.id) && (
                              <Link
                                href={`/minhas-turmas/${enrollmentId}/conteudo/aula/${prevLessonIdByLessonId.get(lesson.id)}?secao=exercicios#secoes`}
                                className="text-xs font-medium text-[var(--igh-primary)] underline hover:no-underline"
                              >
                                Ir para exercícios da aula anterior
                              </Link>
                            )}
                          </span>
                        )
                      ) : (
                        <span
                          className="shrink-0 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]"
                          aria-label="Aula ainda não liberada"
                        >
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
      </div>

      <DashboardTutorial
        showForStudent={user.role !== "MASTER"}
        steps={tutorialSteps}
        storageKey="minhas-turmas-conteudo-tutorial-done"
      />
    </div>
  );
}
