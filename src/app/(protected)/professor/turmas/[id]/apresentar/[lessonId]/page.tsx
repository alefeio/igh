"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { HighlightableContentViewer } from "@/components/lesson/HighlightableContentViewer";
import { LessonVideoPlayer } from "@/components/lesson/LessonVideoPlayer";
import type { ApiResponse } from "@/lib/api-types";
import { splitContentByH1 } from "@/lib/lesson-slides";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Type,
} from "lucide-react";

function getAttachmentLabel(url: string, index: number, customName?: string): string {
  const trimmed = customName?.trim();
  if (trimmed && trimmed.length > 0) return trimmed;
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split("/").filter(Boolean).pop();
    if (name && name.length > 0) return decodeURIComponent(name);
  } catch {
    /* ignore */
  }
  return `Arquivo de apoio ${index + 1}`;
}

type LessonPayload = {
  id: string;
  title: string;
  order: number;
  durationMinutes: number | null;
  videoUrl: string | null;
  contentRich: string | null;
  summary: string | null;
  imageUrls: string[];
  pdfUrl: string | null;
  attachmentUrls: string[];
  attachmentNames: string[];
};

type ExercisePayload = {
  id: string;
  order: number;
  question: string;
  options: { id: string; order: number; text: string; isCorrect: boolean }[];
};

export default function ProfessorApresentarAulaPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const classGroupId = params.id as string;
  const lessonId = params.lessonId as string;
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [courseName, setCourseName] = useState("");
  const [nav, setNav] = useState<{ prevLessonId: string | null; nextLessonId: string | null }>({
    prevLessonId: null,
    nextLessonId: null,
  });
  const [lesson, setLesson] = useState<LessonPayload | null>(null);
  const [exercises, setExercises] = useState<ExercisePayload[]>([]);
  const [contentFontSizePercent, setContentFontSizePercent] = useState(100);
  const [isContentFullscreen, setIsContentFullscreen] = useState(false);
  const [showExerciseAnswers, setShowExerciseAnswers] = useState(false);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const contentPageIndexRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/class-groups/${classGroupId}/presentation/${lessonId}`);
      const json = (await res.json()) as ApiResponse<{
        classGroup: { courseName: string };
        navigation: { prevLessonId: string | null; nextLessonId: string | null };
        lesson: LessonPayload;
        exercises: ExercisePayload[];
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Aula indisponível.");
        setLesson(null);
        return;
      }
      setCourseName(json.data.classGroup.courseName);
      setNav(json.data.navigation);
      setLesson(json.data.lesson);
      setExercises(json.data.exercises);
    } finally {
      setLoading(false);
    }
  }, [classGroupId, lessonId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setShowExerciseAnswers(false);
    setContentFontSizePercent(100);
  }, [lessonId]);

  const contentPages = useMemo(() => splitContentByH1(lesson?.contentRich?.trim() ?? ""), [lesson?.contentRich]);

  const hasMultiplePages = contentPages.length > 1;
  const totalPages = contentPages.length;

  const paginaParam = searchParams.get("pagina");
  const parsedPagina = paginaParam != null ? parseInt(paginaParam, 10) : NaN;
  const contentPageIndexFromUrl =
    hasMultiplePages && totalPages > 0 && Number.isFinite(parsedPagina)
      ? Math.max(0, Math.min(totalPages - 1, parsedPagina - 1))
      : null;
  const contentPageIndex = hasMultiplePages ? (contentPageIndexFromUrl ?? 0) : 0;

  const currentContentSection = contentPages[contentPageIndex];
  const contentToShow =
    hasMultiplePages && currentContentSection
      ? currentContentSection.html
      : (lesson?.contentRich ?? "");

  contentPageIndexRef.current = contentPageIndex;

  const presentationPath = `/professor/turmas/${classGroupId}/apresentar/${lessonId}`;

  const goToSlide = useCallback(
    (index: number) => {
      if (!hasMultiplePages || !lesson) return;
      const clamped = Math.max(0, Math.min(totalPages - 1, index));
      router.replace(`${presentationPath}?pagina=${clamped + 1}#conteudo`);
      setTimeout(() => contentWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    },
    [hasMultiplePages, lesson, presentationPath, router, totalPages]
  );

  const gotoPrevSlide = useCallback(() => {
    if (!hasMultiplePages) return;
    const cur = contentPageIndexRef.current;
    if (cur <= 0) return;
    goToSlide(cur - 1);
  }, [goToSlide, hasMultiplePages]);

  const gotoNextSlide = useCallback(() => {
    if (!hasMultiplePages) return;
    const cur = contentPageIndexRef.current;
    const last = totalPages - 1;
    if (cur >= last) return;
    goToSlide(cur + 1);
  }, [goToSlide, hasMultiplePages, totalPages]);

  useEffect(() => {
    if (!hasMultiplePages) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
      }

      e.preventDefault();
      if (e.key === "ArrowLeft") gotoPrevSlide();
      else gotoNextSlide();
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasMultiplePages, gotoPrevSlide, gotoNextSlide]);

  useEffect(() => {
    const onFs = () =>
      setIsContentFullscreen(
        !!document.fullscreenElement && document.fullscreenElement === contentWrapperRef.current
      );
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  if (loading && !lesson) {
    return (
      <div className="flex min-w-0 justify-center py-16">
        <p className="text-sm text-[var(--text-muted)]">Carregando aula…</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex min-w-0 flex-col gap-4 py-8">
        <p className="text-[var(--text-muted)]">Aula não encontrada.</p>
        <Link href={`/professor/turmas/${classGroupId}/apresentar`} className="text-[var(--igh-primary)] hover:underline">
          ← Lista de aulas
        </Link>
      </div>
    );
  }

  const base = `/professor/turmas/${classGroupId}/apresentar`;

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow={courseName}
        title={lesson.title}
        description={
          lesson.durationMinutes
            ? `Carga indicada: ~${lesson.durationMinutes} min. Use os slides abaixo ou o vídeo para apresentar aos alunos.`
            : "Apresentação para sala de aula — sem registro de progresso dos alunos."
        }
        rightSlot={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className="flex flex-wrap gap-2">
              {nav.prevLessonId ? (
                <Link
                  href={`${base}/${nav.prevLessonId}`}
                  className="inline-flex items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium"
                >
                  ← Aula anterior
                </Link>
              ) : null}
              {nav.nextLessonId ? (
                <Link
                  href={`${base}/${nav.nextLessonId}`}
                  className="inline-flex items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium"
                >
                  Próxima aula →
                </Link>
              ) : null}
            </div>
            <Link
              href={`/professor/turmas/${classGroupId}/apresentar`}
              className="text-center text-sm text-[var(--igh-primary)] hover:underline sm:text-right"
            >
              Índice de aulas
            </Link>
          </div>
        }
      />

      {lesson.summary && lesson.summary.trim() && (
        <SectionCard
          title="Resumo rápido da aula"
          description="O que você vai aprender nesta lição."
          variant="elevated"
          dataTour="aula-resumo"
        >
          <div className="rounded-xl border border-[var(--igh-primary)]/25 bg-[var(--igh-primary)]/5 px-4 py-4">
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--text-secondary)]">
              {lesson.summary
                .trim()
                .split(/\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, i) => (
                  <li key={i}>{line.replace(/^[•\-*]\s*/, "")}</li>
                ))}
            </ul>
          </div>
        </SectionCard>
      )}

      {lesson.videoUrl && (
        <SectionCard title="Vídeo da aula" variant="elevated">
          <div className="flex justify-center overflow-hidden rounded-xl bg-black shadow-inner">
            <div className="aspect-video w-full max-w-3xl">
              <LessonVideoPlayer videoUrl={lesson.videoUrl} />
            </div>
          </div>
        </SectionCard>
      )}

      {lesson.contentRich && lesson.contentRich.trim() && (
        <div id="conteudo" className="scroll-mt-24">
          <SectionCard
            title="Conteúdo para leitura"
            description="Páginas do material, tamanho da fonte, destaques e tela cheia."
          >
            <div
              ref={contentWrapperRef}
              className={`rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 ${isContentFullscreen ? "min-h-screen overflow-y-auto overflow-x-hidden p-6" : ""}`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                {hasMultiplePages ? (
                  <nav aria-label="Páginas do conteúdo" className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToSlide(contentPageIndex - 1)}
                      disabled={contentPageIndex === 0}
                      aria-label="Slide anterior"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:px-3 sm:py-1.5"
                    >
                      <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="hidden sm:inline">Slide anterior</span>
                    </button>
                    <span className="text-sm text-[var(--text-muted)]">
                      <span className="hidden sm:inline">Página </span>
                      {contentPageIndex + 1}/{contentPages.length}
                    </span>
                    {contentPageIndex === contentPages.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => goToSlide(0)}
                        aria-label="Primeiro slide"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:px-3 sm:py-1.5"
                      >
                        <ChevronsLeft className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="hidden sm:inline">Primeiro slide</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => goToSlide(contentPageIndex + 1)}
                        aria-label="Próximo slide"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:px-3 sm:py-1.5"
                      >
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="hidden sm:inline">Próximo slide</span>
                      </button>
                    )}
                  </nav>
                ) : (
                  <span aria-hidden />
                )}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setContentFontSizePercent((p) => Math.max(50, p - 10))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-50"
                    title="Diminuir fonte"
                    aria-label="Diminuir fonte do texto"
                    disabled={contentFontSizePercent <= 50}
                  >
                    <Type className="mr-0.5 h-4 w-4" aria-hidden />
                    <Minus className="h-3 w-3" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentFontSizePercent((p) => Math.min(200, p + 10))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-50"
                    title="Aumentar fonte"
                    aria-label="Aumentar fonte do texto"
                    disabled={contentFontSizePercent >= 200}
                  >
                    <Type className="mr-0.5 h-4 w-4" aria-hidden />
                    <Plus className="h-3 w-3" aria-hidden />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    document.fullscreenElement === contentWrapperRef.current
                      ? void document.exitFullscreen()
                      : void contentWrapperRef.current?.requestFullscreen()
                  }
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:px-3 sm:py-1.5"
                  title={isContentFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                  aria-label={isContentFullscreen ? "Sair da tela cheia" : "Expandir em tela cheia"}
                >
                  {isContentFullscreen ? (
                    <Minimize2 className="h-4 w-4" aria-hidden />
                  ) : (
                    <Maximize2 className="h-4 w-4" aria-hidden />
                  )}
                  <span className="hidden sm:inline">{isContentFullscreen ? "Sair da tela cheia" : "Tela cheia"}</span>
                </button>
              </div>
              <div className="overflow-auto" style={{ minHeight: "12rem" }}>
                <div
                  className="origin-top-left"
                  style={{
                    width: `${10000 / contentFontSizePercent}%`,
                    transform: `scale(${contentFontSizePercent / 100})`,
                  }}
                >
                  <HighlightableContentViewer
                    content={contentToShow}
                    passages={[]}
                    onSavePassage={() => {}}
                    saving={false}
                    hideDestacarButton
                  />
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {(lesson.pdfUrl?.trim() || lesson.attachmentUrls.some((u) => u?.trim())) && (
        <SectionCard title="Material complementar" variant="elevated">
          <div className="flex flex-col gap-2 text-sm">
            {lesson.pdfUrl?.trim() && (
              <a
                href={lesson.pdfUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--igh-primary)] hover:underline"
              >
                Abrir PDF da aula (nova aba)
              </a>
            )}
            {lesson.attachmentUrls
              .map((url, index) => ({ url: url?.trim() ?? "", index }))
              .filter((x) => x.url)
              .map(({ url, index }) => (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--igh-primary)] hover:underline"
                >
                  {getAttachmentLabel(url, index, lesson.attachmentNames[index])}
                </a>
              ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Exercícios"
        description="Os alunos respondem na área deles. Use o botão para exibir o gabarito (fundo verde nas corretas)."
        variant="elevated"
        action={
          exercises.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowExerciseAnswers((v) => !v)}
              className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--card-bg)] sm:text-sm"
            >
              {showExerciseAnswers ? "Ocultar respostas" : "Exibir respostas"}
            </button>
          ) : null
        }
      >
        {exercises.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Não há exercícios nesta aula.</p>
        ) : (
          <div className="space-y-6">
            {exercises.map((ex, exIdx) => (
              <div key={ex.id} className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/20 p-4">
                <p className="text-xs font-semibold text-[var(--text-muted)]">Questão {exIdx + 1}</p>
                <p className="mt-1 font-medium text-[var(--text-primary)]">{ex.question}</p>
                <ul className="mt-3 list-none space-y-1.5 p-0">
                  {ex.options.map((o) => {
                    const reveal = showExerciseAnswers && o.isCorrect;
                    return (
                      <li
                        key={o.id}
                        className={`rounded-md border px-3 py-2 text-sm ${
                          reveal
                            ? "border-emerald-500/60 bg-emerald-500/15 text-[var(--text-primary)]"
                            : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {o.text}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
