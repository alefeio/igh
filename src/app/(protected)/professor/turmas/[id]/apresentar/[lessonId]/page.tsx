"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { HighlightableContentViewer, type LessonPassage } from "@/components/lesson/HighlightableContentViewer";
import { LessonVideoPlayer } from "@/components/lesson/LessonVideoPlayer";
import type { ApiResponse } from "@/lib/api-types";
import { splitContentByH1 } from "@/lib/lesson-slides";
import { apimagesUploadHeaders, buildApimagesUploadFormData, parseApimagesUploadJson } from "@/lib/apimages-upload";
import { hostedRawUrlForDownload } from "@/lib/hosted-file-url";
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

type LessonQuestion = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  teacherReplies: { id: string; content: string; createdAt: string; teacherName: string }[];
};

type TeacherNote = { id: string; content: string; createdAt: string };

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

  const [passages, setPassages] = useState<LessonPassage[]>([]);
  const [savingPassage, setSavingPassage] = useState(false);
  const [notes, setNotes] = useState<TeacherNote[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [replyContentByQuestionId, setReplyContentByQuestionId] = useState<Record<string, string>>({});
  const [replyingQuestionId, setReplyingQuestionId] = useState<string | null>(null);

  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentDisplayName, setAttachmentDisplayName] = useState("");

  const localStoragePassagesKey = `teacher-presentation:${classGroupId}:${lessonId}:passages`;
  const localStorageNotesKey = `teacher-presentation:${classGroupId}:${lessonId}:notes`;

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
    // restaurar notas/trechos locais do professor
    try {
      const rawPassages = localStorage.getItem(localStoragePassagesKey);
      if (rawPassages) setPassages(JSON.parse(rawPassages) as LessonPassage[]);
      else setPassages([]);
    } catch {
      setPassages([]);
    }
    try {
      const rawNotes = localStorage.getItem(localStorageNotesKey);
      if (rawNotes) setNotes(JSON.parse(rawNotes) as TeacherNote[]);
      else setNotes([]);
    } catch {
      setNotes([]);
    }
  }, [lessonId]);

  useEffect(() => {
    try {
      localStorage.setItem(localStoragePassagesKey, JSON.stringify(passages));
    } catch {
      // ignore
    }
  }, [localStoragePassagesKey, passages]);

  useEffect(() => {
    try {
      localStorage.setItem(localStorageNotesKey, JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [localStorageNotesKey, notes]);

  const loadQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      const res = await fetch(`/api/teacher/class-groups/${classGroupId}/lesson-questions?lessonId=${lessonId}`);
      const json = (await res.json()) as ApiResponse<{ questions: LessonQuestion[] }>;
      if (!res.ok || !json.ok) {
        setQuestions([]);
        return;
      }
      setQuestions(json.data.questions);
    } finally {
      setLoadingQuestions(false);
    }
  }, [classGroupId, lessonId]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const handleSavePassage = useCallback(
    (payload: { text: string; startOffset: number }) => {
      const text = payload.text.trim();
      if (!text) return;
      const id = `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setPassages((prev) => [{ id, text, startOffset: payload.startOffset, createdAt: new Date().toISOString() }, ...prev]);
    },
    []
  );

  const handleRemovePassage = useCallback((id: string) => {
    setPassages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleAddNote = useCallback(() => {
    const text = noteContent.trim();
    if (text.length < 1) return;
    const id = `n_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setNotes((prev) => [{ id, content: text, createdAt: new Date().toISOString() }, ...prev]);
    setNoteContent("");
  }, [noteContent]);

  const handleReply = useCallback(
    async (questionId: string) => {
      const content = (replyContentByQuestionId[questionId] ?? "").trim();
      if (content.length < 2) return;
      setReplyingQuestionId(questionId);
      try {
        const res = await fetch(`/api/teacher/class-groups/${classGroupId}/lesson-questions/${questionId}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const json = (await res.json()) as ApiResponse<{ id: string; content: string; createdAt: string; teacherName: string }>;
        if (!res.ok || !json.ok) {
          toast.push("error", !json.ok ? json.error.message : "Falha ao responder.");
          return;
        }
        setReplyContentByQuestionId((prev) => ({ ...prev, [questionId]: "" }));
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId
              ? { ...q, teacherReplies: [...(q.teacherReplies ?? []), json.data] }
              : q
          )
        );
      } finally {
        setReplyingQuestionId(null);
      }
    },
    [classGroupId, replyContentByQuestionId, toast]
  );

  const handleUploadAttachment = useCallback(
    async (file: File) => {
      setUploadingAttachment(true);
      try {
        const signRes = await fetch("/api/teacher/uploads/apimages-signature", { method: "POST" });
        const signJson = (await signRes.json()) as ApiResponse<{ uploadUrl: string; apiKey: string }>;
        if (!signRes.ok || !signJson.ok) {
          toast.push("error", !signJson.ok ? signJson.error.message : "Falha ao preparar upload.");
          return;
        }

        const fd = buildApimagesUploadFormData(file);
        const uploadRes = await fetch(signJson.data.uploadUrl, {
          method: "POST",
          headers: apimagesUploadHeaders(signJson.data.apiKey),
          body: fd,
        });
        const uploadJson = await uploadRes.json();
        const parsed = parseApimagesUploadJson(uploadJson);
        if (!uploadRes.ok || parsed.errorMessage || !parsed.url) {
          toast.push("error", parsed.errorMessage ?? "Falha no upload.");
          return;
        }

        const persistRes = await fetch(
          `/api/teacher/class-groups/${classGroupId}/presentation/${lessonId}/attachments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: parsed.url,
              name: attachmentDisplayName.trim() || file.name,
            }),
          }
        );
        const persistJson = (await persistRes.json()) as ApiResponse<{ lesson: { attachmentUrls: string[]; attachmentNames: string[] } }>;
        if (!persistRes.ok || !persistJson.ok) {
          toast.push("error", !persistJson.ok ? persistJson.error.message : "Falha ao salvar anexo.");
          return;
        }

        setLesson((prev) =>
          prev
            ? {
                ...prev,
                attachmentUrls: persistJson.data.lesson.attachmentUrls,
                attachmentNames: persistJson.data.lesson.attachmentNames,
              }
            : prev
        );
        setAttachmentDisplayName("");
        toast.push("success", "Material anexado e disponível para os alunos.");
      } finally {
        setUploadingAttachment(false);
      }
    },
    [attachmentDisplayName, classGroupId, lessonId, toast]
  );

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
    const sync = () => {
      const active =
        !!document.fullscreenElement && document.fullscreenElement === contentWrapperRef.current;
      setIsContentFullscreen(active);
      const html = document.documentElement;
      if (active) {
        html.classList.add("professor-presentation-fs-lock");
      } else {
        html.classList.remove("professor-presentation-fs-lock");
      }
    };
    document.addEventListener("fullscreenchange", sync);
    sync();
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.documentElement.classList.remove("professor-presentation-fs-lock");
    };
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
              className={`flex min-h-0 flex-col rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 ${
                isContentFullscreen
                  ? "overflow-hidden p-6 [&:fullscreen]:box-border [&:fullscreen]:max-h-[100dvh] [&:fullscreen]:min-h-0 [&:fullscreen]:h-[100dvh] [&:fullscreen]:w-full [&:fullscreen]:max-w-none [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
                  : ""
              }`}
            >
              <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
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
              <div
                className={
                  isContentFullscreen
                    ? "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [overflow-anchor:none]"
                    : "min-h-[12rem] overflow-auto overscroll-contain"
                }
              >
                <div
                  className="professor-presentation-text-scale min-w-0"
                  style={
                    {
                      "--presentation-font-scale": String(contentFontSizePercent / 100),
                    } as CSSProperties
                  }
                >
                  <HighlightableContentViewer
                    content={contentToShow}
                    passages={passages}
                    onSavePassage={handleSavePassage}
                    onRemovePassage={handleRemovePassage}
                    saving={savingPassage}
                  />
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      <SectionCard title="Material complementar" variant="elevated">
        {!(lesson.pdfUrl?.trim() || lesson.attachmentUrls.some((u) => u?.trim())) ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum material complementar nesta aula.</p>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            {lesson.pdfUrl?.trim() && (
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={lesson.pdfUrl.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--igh-primary)] hover:underline"
                >
                  Visualizar PDF da aula
                </a>
                <a
                  href={hostedRawUrlForDownload(lesson.pdfUrl.trim())}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-secondary)] hover:underline"
                >
                  Baixar PDF
                </a>
              </div>
            )}

            {lesson.attachmentUrls
              .map((u, index) => ({ url: u?.trim() ?? "", index }))
              .filter((x) => x.url)
              .map(({ url, index }) => {
                const label = getAttachmentLabel(url, index, lesson.attachmentNames[index]);
                return (
                  <div key={index} className="flex flex-wrap items-center gap-3">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--igh-primary)] hover:underline"
                    >
                      {label}
                    </a>
                    <a
                      href={hostedRawUrlForDownload(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--text-secondary)] hover:underline"
                    >
                      Baixar
                    </a>
                  </div>
                );
              })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Anexar novo material complementar"
        description="Este material será adicionado à aula e ficará disponível para os alunos (aceita qualquer tipo de arquivo)."
        variant="elevated"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[var(--text-primary)]">Nome exibido (opcional)</label>
            <input
              value={attachmentDisplayName}
              onChange={(e) => setAttachmentDisplayName(e.target.value)}
              placeholder="Ex.: Planilha de exercícios, Material extra, etc."
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <label className="inline-flex w-fit cursor-pointer items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--card-bg)] disabled:opacity-50">
            <input
              type="file"
              accept="*/*"
              className="hidden"
              disabled={uploadingAttachment}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadAttachment(f);
                e.target.value = "";
              }}
            />
            {uploadingAttachment ? "Enviando…" : "Escolher arquivo"}
          </label>
          <p className="text-xs text-[var(--text-muted)]">
            Dica: para arquivos grandes, prefira PDF quando possível.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Bloco de anotações (professor)"
        description="Anotações pessoais para esta aula (salvas neste navegador)."
        variant="elevated"
      >
        <div className="flex flex-col gap-3">
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Digite suas anotações..."
            className="min-h-[110px] w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-sm text-[var(--text-primary)]"
          />
          <button
            type="button"
            onClick={handleAddNote}
            className="inline-flex w-fit items-center justify-center rounded-md bg-[var(--igh-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            disabled={noteContent.trim().length === 0}
          >
            Salvar anotação
          </button>

          {notes.length > 0 && (
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/20 p-3">
                  <p className="text-xs text-[var(--text-muted)]">{new Date(n.createdAt).toLocaleString("pt-BR")}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Fórum da aula"
        description="Dúvidas dos alunos nesta aula (você pode responder)."
        variant="elevated"
      >
        {loadingQuestions ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando fórum…</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhuma dúvida nesta aula ainda.</p>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/10 p-4">
                <p className="text-xs font-semibold text-[var(--text-muted)]">
                  {q.authorName} · {new Date(q.createdAt).toLocaleString("pt-BR")}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{q.content}</p>

                {q.teacherReplies?.length > 0 && (
                  <div className="mt-3 space-y-2 border-l border-[var(--card-border)] pl-3">
                    {q.teacherReplies.map((r) => (
                      <div key={r.id} className="text-sm">
                        <p className="text-xs text-[var(--text-muted)]">
                          {r.teacherName} · {new Date(r.createdAt).toLocaleString("pt-BR")}
                        </p>
                        <p className="whitespace-pre-wrap text-[var(--text-secondary)]">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2">
                  <textarea
                    value={replyContentByQuestionId[q.id] ?? ""}
                    onChange={(e) => setReplyContentByQuestionId((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Responder..."
                    className="min-h-[80px] w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-sm text-[var(--text-primary)]"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleReply(q.id)}
                      disabled={replyingQuestionId === q.id || (replyContentByQuestionId[q.id] ?? "").trim().length < 2}
                      className="inline-flex w-fit items-center justify-center rounded-md bg-[var(--igh-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                    >
                      {replyingQuestionId === q.id ? "Enviando…" : "Responder"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

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
