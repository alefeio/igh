"use client";

import { BookOpen, AlertCircle, CheckCircle2, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
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
  modules: Module[];
  exerciseStats?: ExerciseStats;
};

export default function ConteudoPage() {
  const params = useParams();
  const enrollmentId = params?.id as string;
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CourseContentData | null>(null);

  useEffect(() => {
    if (!enrollmentId) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/me/enrollments/${enrollmentId}/course-content`);
        const json = (await res.json()) as ApiResponse<CourseContentData>;
        if (res.ok && json?.ok) setData(json.data);
        else toast.push("error", json && "error" in json ? json.error.message : "Conteúdo não disponível ou ainda não liberado.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [enrollmentId, toast]);

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
          className="text-sm text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
          href={`/minhas-turmas/${enrollmentId}`}
        >
          ← Voltar à turma
        </Link>
      </nav>

      {/* Seu progresso — sempre com dados do course-content (nunca falha) */}
      {totalLessons > 0 && (
        <section
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
        <header className="card-header">
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
            data.modules.map((mod) => (
              <section
                key={mod.id}
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
    </div>
  );
}
