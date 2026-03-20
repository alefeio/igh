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
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DashboardHero, QuickActionGrid, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type LessonStat = {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  moduleOrder: number;
  totalAttempts: number;
  correctAttempts: number;
  ratio?: number;
  lastAttemptCorrect?: boolean | null;
};

type CourseExercisesResponse = {
  courseName: string;
  exerciseStats?: {
    totalCorrect: number;
    totalAttempts: number;
    lessonStats: LessonStat[];
    topicsBem?: { lessonId: string }[];
    topicsAtencao?: { lessonId: string }[];
  };
};

function lessonExerciseHref(enrollmentId: string, lessonId: string) {
  return `/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}?secao=exercicios#secoes`;
}

export default function EnrollmentExercisesSummaryPage() {
  const params = useParams();
  const enrollmentId = params?.id as string;
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CourseExercisesResponse | null>(null);

  useEffect(() => {
    if (!enrollmentId) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/me/enrollments/${enrollmentId}/course-content`);
        const json = (await res.json()) as ApiResponse<CourseExercisesResponse>;
        if (res.ok && json?.ok) {
          setData(json.data);
        } else {
          toast.push(
            "error",
            json && "error" in json ? json.error.message : "Não foi possível carregar os exercícios."
          );
          setData(null);
        }
      } catch {
        toast.push("error", "Não foi possível carregar os exercícios.");
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [enrollmentId, toast]);

  const sortedLessons = useMemo(() => {
    const list = data?.exerciseStats?.lessonStats ?? [];
    return list
      .slice()
      .sort(
        (a, b) =>
          a.moduleOrder - b.moduleOrder || a.lessonTitle.localeCompare(b.lessonTitle, "pt-BR")
      );
  }, [data?.exerciseStats?.lessonStats]);

  const lessonsByModule = useMemo(() => {
    const map: { moduleOrder: number; moduleTitle: string; lessons: LessonStat[] }[] = [];
    for (const lesson of sortedLessons) {
      const last = map[map.length - 1];
      if (last && last.moduleOrder === lesson.moduleOrder && last.moduleTitle === lesson.moduleTitle) {
        last.lessons.push(lesson);
      } else {
        map.push({
          moduleOrder: lesson.moduleOrder,
          moduleTitle: lesson.moduleTitle,
          lessons: [lesson],
        });
      }
    }
    return map;
  }, [sortedLessons]);

  const lessonNumberById = useMemo(() => {
    const m = new Map<string, number>();
    sortedLessons.forEach((l, i) => m.set(l.lessonId, i + 1));
    return m;
  }, [sortedLessons]);

  if (!enrollmentId) {
    return (
        <div className="flex min-w-0 flex-col pb-8 pt-0">
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-10 text-center shadow-inner">
            <p className="text-sm font-medium text-[var(--text-muted)]">Matrícula não encontrada.</p>
          </div>
        </div>
    );
  }

  if (loading || !data) {
    return (
        <div className="flex min-w-0 flex-col gap-6 pb-8 pt-0">
          <Link
            href={`/minhas-turmas/${enrollmentId}/conteudo`}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
            Voltar ao conteúdo
          </Link>
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-10 text-center shadow-inner">
            <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-[var(--igh-primary)]/20" />
            <p className="text-sm font-medium text-[var(--text-muted)]">
              {loading ? "Carregando seu desempenho…" : "Dados não encontrados."}
            </p>
          </div>
        </div>
    );
  }

  const stats = data.exerciseStats;
  const lessonStats = stats?.lessonStats ?? [];
  const hasAttempts = (stats?.totalAttempts ?? 0) > 0 && lessonStats.length > 0;
  const pct =
    (stats?.totalAttempts ?? 0) > 0
      ? Math.round(((stats?.totalCorrect ?? 0) / (stats?.totalAttempts ?? 1)) * 100)
      : 0;
  const topicsBem = stats?.topicsBem ?? [];
  const topicsAtencao = stats?.topicsAtencao ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-8 pb-10 pt-1 sm:gap-10">
        <nav aria-label="Navegação">
          <Link
            href={`/minhas-turmas/${enrollmentId}/conteudo`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
            Voltar ao conteúdo do curso
          </Link>
        </nav>

        <DashboardHero
          eyebrow="Prática e revisão"
          title="Exercícios por aula"
          description={
            <>
              Acompanhe acertos, erros e onde vale a pena revisar — tudo ligado ao curso{" "}
              <span className="font-semibold text-[var(--text-primary)]">{data.courseName}</span>.
            </>
          }
          rightSlot={
            <div className="hidden items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 text-left shadow-sm sm:flex">
              <Target className="h-8 w-8 shrink-0 text-[var(--igh-primary)]" aria-hidden />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Foco</p>
                <p className="text-sm font-bold text-[var(--text-primary)]">Questões ao final das aulas</p>
              </div>
            </div>
          }
        />

        <SectionCard
          title="Resumo dos exercícios"
          description={`Curso: ${data.courseName}`}
          id="exercises-summary-heading"
          variant="elevated"
          className="border-[var(--igh-primary)]/12 bg-gradient-to-br from-[var(--igh-surface)]/50 to-[var(--card-bg)]"
        >
          {!hasAttempts ? (
            <div className="rounded-2xl border border-dashed border-[var(--igh-primary)]/25 bg-[var(--igh-surface)]/40 px-5 py-10 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-[var(--igh-primary)]/60" aria-hidden />
              <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
                Você ainda não respondeu exercícios neste curso. Abra uma aula pelo{" "}
                <Link href={`/minhas-turmas/${enrollmentId}/conteudo`} className="font-bold text-[var(--igh-primary)] hover:underline">
                  conteúdo do curso
                </Link>{" "}
                e responda às questões ao final de cada aula para ver acertos e erros aqui.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-inner sm:gap-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--igh-primary)]/25 to-violet-500/15 text-[var(--igh-primary)] shadow-sm">
                  <Sparkles className="h-7 w-7" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Desempenho geral
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--text-primary)] sm:text-4xl">
                    {stats?.totalCorrect ?? 0}
                    <span className="ml-2 text-lg font-semibold text-[var(--text-muted)] sm:text-xl">
                      / {stats?.totalAttempts ?? 0} acertos
                    </span>
                    <span className="ml-3 text-2xl font-bold text-[var(--igh-primary)]">({pct}%)</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {topicsBem.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      {topicsBem.length} aula{topicsBem.length > 1 ? "s" : ""} em destaque
                    </span>
                  )}
                  {topicsAtencao.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-100">
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                      {topicsAtencao.length} para revisar
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-10 space-y-10">
                <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                  <ListVideo className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
                  Detalhe por aula
                </h3>

                {lessonsByModule.map((mod) => (
                  <div key={`${mod.moduleOrder}-${mod.moduleTitle}`}>
                    <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--igh-primary)]">
                      Módulo {mod.moduleOrder + 1} · {mod.moduleTitle}
                    </p>
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={`Exercícios — ${mod.moduleTitle}`}>
                      {mod.lessons.map((lesson) => {
                        const errors = Math.max(0, lesson.totalAttempts - lesson.correctAttempts);
                        const hasErrors = errors > 0;
                        const ratioPct =
                          lesson.ratio != null
                            ? Math.round(lesson.ratio * 100)
                            : lesson.totalAttempts > 0
                              ? Math.round((lesson.correctAttempts / lesson.totalAttempts) * 100)
                              : 0;
                        const precisaRevisar = topicsAtencao.some((t) => t.lessonId === lesson.lessonId);
                        const estaBem = topicsBem.some((t) => t.lessonId === lesson.lessonId);
                        const aulaNoCurso = lessonNumberById.get(lesson.lessonId) ?? 0;

                        return (
                          <li key={lesson.lessonId}>
                            <div
                              className={`flex h-full flex-col rounded-2xl border p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${
                                precisaRevisar
                                  ? "border-amber-400/80 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/20"
                                  : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--igh-primary)]/30"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <span
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--igh-surface)] text-xs font-bold tabular-nums text-[var(--text-muted)] ring-1 ring-[var(--card-border)]"
                                  title={`Aula ${aulaNoCurso} no curso`}
                                >
                                  {aulaNoCurso}
                                </span>
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${
                                    ratioPct >= 70
                                      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                                      : ratioPct >= 50
                                        ? "bg-[var(--igh-surface)] text-[var(--text-secondary)]"
                                        : "bg-amber-500/15 text-amber-900 dark:text-amber-100"
                                  }`}
                                >
                                  {ratioPct}% acertos
                                </span>
                              </div>
                              <p className="mt-3 line-clamp-3 text-sm font-bold leading-snug text-[var(--text-primary)]">
                                {lesson.lessonTitle}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                  Acertos: {lesson.correctAttempts}
                                </span>
                                <span className="font-semibold text-red-700 dark:text-red-400">
                                  Erros: {errors}
                                </span>
                              </div>
                              {hasErrors ? (
                                <div className="mt-4 flex flex-1 flex-col justify-end gap-2 border-t border-[var(--card-border)] pt-4">
                                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                    Vale revisar esta aula.
                                  </p>
                                  <Link
                                    href={lessonExerciseHref(enrollmentId, lesson.lessonId)}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-[var(--igh-primary)] hover:underline"
                                  >
                                    Abrir exercícios desta aula
                                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                                  </Link>
                                </div>
                              ) : (
                                <p className="mt-4 flex flex-1 items-end gap-1.5 border-t border-[var(--card-border)] pt-4 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  {estaBem ? "Ótimo desempenho nas tentativas." : "Nenhum erro registrado."}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        <section aria-label="Atalhos">
          <h2 className="mb-1 text-lg font-bold text-[var(--text-primary)]">Atalhos úteis</h2>
          <p className="mb-4 text-sm text-[var(--text-muted)]">Volte ao estudo ou navegue na matrícula.</p>
          <QuickActionGrid
            items={[
              {
                href: `/minhas-turmas/${enrollmentId}/conteudo`,
                label: "Conteúdo do curso",
                description: "Aulas, módulos e progresso",
                icon: BookOpen,
                accent: "from-[var(--igh-primary)] to-violet-600",
              },
              {
                href: `/minhas-turmas/${enrollmentId}`,
                label: "Detalhe da turma",
                description: "Informações da matrícula",
                icon: GraduationCap,
                accent: "from-slate-600 to-slate-800",
              },
              {
                href: "/minhas-turmas/favoritos",
                label: "Favoritos",
                description: "Aulas salvas",
                icon: Star,
                accent: "from-amber-500 to-orange-600",
              },
            ]}
          />
        </section>
    </div>
  );
}
