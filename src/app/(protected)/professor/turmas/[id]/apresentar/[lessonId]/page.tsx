"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardTutorial, type TutorialStep } from "@/components/dashboard/DashboardTutorial";
import { useToast } from "@/components/feedback/ToastProvider";
import { ForumPostBody } from "@/components/forum/ForumPostBody";
import { ForumPostComposer } from "@/components/forum/ForumPostComposer";
import { HighlightableContentViewer, type LessonPassage } from "@/components/lesson/HighlightableContentViewer";
import { LessonVideoPlayer } from "@/components/lesson/LessonVideoPlayer";
import type { ApiResponse } from "@/lib/api-types";
import { isForumPostEmpty } from "@/lib/forum-question-content";
import { splitContentByH1 } from "@/lib/lesson-slides";
import { apimagesUploadHeaders, buildApimagesUploadFormData, parseApimagesUploadJson } from "@/lib/apimages-upload";
import { hostedRawUrlForDownload } from "@/lib/hosted-file-url";
import {
  ArrowLeft,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileText,
  Highlighter,
  Maximize2,
  MessageCircleQuestion,
  Minimize2,
  Minus,
  MoreHorizontal,
  Plus,
  Presentation,
  StickyNote,
  Type,
  Wrench,
  X,
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
  imageUrls?: string[];
  createdAt: string;
  updatedAt: string;
  authorName: string;
  teacherReplies: { id: string; content: string; createdAt: string; teacherName: string }[];
};

const TEACHER_FORUM_UPLOAD = "/api/teacher/uploads/apimages-signature";

type TeacherNote = { id: string; content: string; createdAt: string };

type SectionKey = "trechos" | "material" | "anotacoes" | "duvidas" | "exercicios" | "resumo";

const SECTION_KEYS: SectionKey[] = ["trechos", "material", "anotacoes", "duvidas", "exercicios", "resumo"];

function isSectionKey(v: string | null): v is SectionKey {
  return !!v && (SECTION_KEYS as string[]).includes(v);
}

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
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const courseNavRef = useRef<HTMLDivElement>(null);

  const [passages, setPassages] = useState<LessonPassage[]>([]);
  const [savingPassage, setSavingPassage] = useState(false);
  const [notes, setNotes] = useState<TeacherNote[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [replyContentByQuestionId, setReplyContentByQuestionId] = useState<Record<string, string>>({});
  const [replyImageUrlsByQuestionId, setReplyImageUrlsByQuestionId] = useState<Record<string, string[]>>({});
  const [replyingQuestionId, setReplyingQuestionId] = useState<string | null>(null);

  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentDisplayName, setAttachmentDisplayName] = useState("");

  const [toolsOpen, setToolsOpen] = useState(false);
  const [courseNavOpen, setCourseNavOpen] = useState(false);
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const [studentPreview, setStudentPreview] = useState(false);
  const [quizFullscreen, setQuizFullscreen] = useState(false);

  const localStoragePassagesKey = `teacher-presentation:${classGroupId}:${lessonId}:passages:v2`;
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
    setOpenSection(null);
    setStudentPreview(false);
    setQuizFullscreen(false);
    try {
      const rawPassages = localStorage.getItem(localStoragePassagesKey);
      if (rawPassages) {
        const parsed = JSON.parse(rawPassages) as LessonPassage[];
        setPassages(
          Array.isArray(parsed)
            ? parsed.map((p) => ({
                ...p,
                pageIndex: Number.isFinite(p.pageIndex as number) ? (p.pageIndex as number) : 0,
              }))
            : []
        );
      } else setPassages([]);
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
  }, [lessonId, localStorageNotesKey, localStoragePassagesKey]);

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

  const presentationPath = `/professor/turmas/${classGroupId}/apresentar/${lessonId}`;
  const base = `/professor/turmas/${classGroupId}/apresentar`;

  const openSectionPanel = useCallback(
    (key: SectionKey) => {
      const willClose = openSection === key;
      const next = willClose ? null : key;
      setOpenSection(next);
      setQuizFullscreen(false);
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("secao", next);
      else params.delete("secao");
      const qs = params.toString();
      const hash = next ? "#ferramentas" : "";
      router.replace(qs ? `${presentationPath}?${qs}${hash}` : `${presentationPath}${hash}`);
      if (next) {
        setTimeout(() => {
          document.getElementById("ferramentas")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
    },
    [openSection, presentationPath, router, searchParams]
  );

  const closeSectionPanel = useCallback(() => {
    setOpenSection(null);
    setQuizFullscreen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("secao");
    const qs = params.toString();
    router.replace(qs ? `${presentationPath}?${qs}` : presentationPath);
  }, [presentationPath, router, searchParams]);

  useEffect(() => {
    const secao = searchParams.get("secao");
    if (isSectionKey(secao)) {
      setOpenSection(secao);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!toolsOpen && !courseNavOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (toolsOpen && toolsMenuRef.current && !toolsMenuRef.current.contains(target)) {
        setToolsOpen(false);
      }
      if (courseNavOpen && courseNavRef.current && !courseNavRef.current.contains(target)) {
        setCourseNavOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [toolsOpen, courseNavOpen]);

  const handleSavePassage = useCallback((payload: { text: string; startOffset: number }) => {
    const text = payload.text.trim();
    if (!text) return;
    setSavingPassage(true);
    try {
      const id = `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const pageIndex = contentPageIndexRef.current ?? 0;
      setPassages((prev) => [
        { id, text, startOffset: payload.startOffset, pageIndex, createdAt: new Date().toISOString() },
        ...prev,
      ]);
    } finally {
      setSavingPassage(false);
    }
  }, []);

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
      const content = replyContentByQuestionId[questionId] ?? "";
      const imageUrls = replyImageUrlsByQuestionId[questionId] ?? [];
      if (isForumPostEmpty(content, imageUrls)) return;
      setReplyingQuestionId(questionId);
      try {
        const res = await fetch(`/api/teacher/class-groups/${classGroupId}/lesson-questions/${questionId}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, imageUrls }),
        });
        const json = (await res.json()) as ApiResponse<{
          id: string;
          content: string;
          createdAt: string;
          teacherName: string;
        }>;
        if (!res.ok || !json.ok) {
          toast.push("error", !json.ok ? json.error.message : "Falha ao responder.");
          return;
        }
        setReplyContentByQuestionId((prev) => ({ ...prev, [questionId]: "" }));
        setReplyImageUrlsByQuestionId((prev) => ({ ...prev, [questionId]: [] }));
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId ? { ...q, teacherReplies: [...(q.teacherReplies ?? []), json.data] } : q
          )
        );
      } finally {
        setReplyingQuestionId(null);
      }
    },
    [classGroupId, replyContentByQuestionId, replyImageUrlsByQuestionId, toast]
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
        const persistJson = (await persistRes.json()) as ApiResponse<{
          lesson: { attachmentUrls: string[]; attachmentNames: string[] };
        }>;
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

  const handleDownloadKit = useCallback(() => {
    if (!lesson) return;
    const opened: string[] = [];
    if (lesson.pdfUrl?.trim()) {
      window.open(hostedRawUrlForDownload(lesson.pdfUrl.trim()), "_blank", "noopener,noreferrer");
      opened.push("PDF da aula");
    }
    lesson.attachmentUrls.forEach((url, index) => {
      const trimmed = url?.trim();
      if (!trimmed) return;
      window.open(hostedRawUrlForDownload(trimmed), "_blank", "noopener,noreferrer");
      opened.push(getAttachmentLabel(trimmed, index, lesson.attachmentNames[index]));
    });
    if (lesson.summary?.trim()) {
      const blob = new Blob(
        [`Resumo — ${lesson.title}\n\n${lesson.summary.trim()}\n`],
        { type: "text/plain;charset=utf-8" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resumo-${lesson.title.replace(/[^\w\-]+/g, "-").slice(0, 60)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      opened.push("Resumo (texto)");
    }
    if (opened.length === 0) {
      toast.push("error", "Esta aula ainda não tem materiais no kit.");
      return;
    }
    toast.push("success", `Kit da aula: ${opened.join(", ")}.`);
  }, [lesson, toast]);

  const enterProjection = useCallback(() => {
    void contentWrapperRef.current?.requestFullscreen();
  }, []);

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
    hasMultiplePages && currentContentSection ? currentContentSection.html : (lesson?.contentRich ?? "");

  contentPageIndexRef.current = contentPageIndex;

  const passagesForCurrentPage = useMemo(() => {
    if (!hasMultiplePages) return passages;
    return passages.filter((p) => (p.pageIndex ?? 0) === contentPageIndex);
  }, [contentPageIndex, hasMultiplePages, passages]);

  const passagesByPage = useMemo(() => {
    if (!hasMultiplePages) {
      return passages.length > 0 ? [{ pageIndex: 0, items: passages }] : [];
    }
    const map = new Map<number, LessonPassage[]>();
    for (const p of passages) {
      const idx = p.pageIndex ?? 0;
      const arr = map.get(idx) ?? [];
      arr.push(p);
      map.set(idx, arr);
    }
    return [...map.entries()]
      .map(([pageIndex, items]) => ({
        pageIndex,
        items: [...items].sort((a, b) => a.startOffset - b.startOffset),
      }))
      .sort((a, b) => a.pageIndex - b.pageIndex);
  }, [hasMultiplePages, passages]);

  const goToSlide = useCallback(
    (index: number) => {
      if (!hasMultiplePages || !lesson) return;
      const clamped = Math.max(0, Math.min(totalPages - 1, index));
      const params = new URLSearchParams(searchParams.toString());
      params.set("pagina", String(clamped + 1));
      router.replace(`${presentationPath}?${params.toString()}#conteudo`);
      if (!isContentFullscreen) {
        setTimeout(() => contentWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      }
    },
    [hasMultiplePages, isContentFullscreen, lesson, presentationPath, router, searchParams, totalPages]
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

  useLayoutEffect(() => {
    if (!hasMultiplePages) return;
    const wrap = contentWrapperRef.current;
    if (!wrap || document.fullscreenElement !== wrap) return;
    wrap.scrollTop = 0;
    wrap.querySelectorAll(".overflow-auto, .overflow-y-auto").forEach((node) => {
      (node as HTMLElement).scrollTop = 0;
    });
  }, [contentPageIndex, hasMultiplePages]);

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

  useEffect(() => {
    if (!quizFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQuizFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quizFullscreen]);

  const hasKit =
    !!lesson?.pdfUrl?.trim() ||
    !!lesson?.summary?.trim() ||
    (lesson?.attachmentUrls?.some((u) => u?.trim()) ?? false);

  const tutorialSteps: TutorialStep[] = useMemo(() => {
    if (!lesson) return [];
    const steps: TutorialStep[] = [
      {
        target: '[data-tour="prof-aula-header"]',
        title: "Modo professor",
        content:
          "Foque no palco (vídeo e slides). Use Ferramentas e Navegar só quando precisar — não competem com o ensino.",
      },
      {
        target: '[data-tour="prof-aula-ferramentas"]',
        title: "Ferramentas",
        content:
          "Material, anotações, fórum, exercícios, kit da aula e preview como aluno ficam neste menu.",
      },
    ];
    if (lesson.contentRich?.trim()) {
      steps.push({
        target: '[data-tour="prof-aula-conteudo"]',
        title: "Projeção limpa",
        content:
          "Use “Projetar slide” para tela cheia só do conteúdo. Ideal para projetor ou compartilhamento de tela.",
      });
    }
    steps.push({
      target: '[data-tour="prof-aula-acessivel"]',
      title: "Checklist rápido",
      content:
        "Antes da aula: confira se o conteúdo está legível, o material está no kit e o quiz está à mão. Prefira fonte maior no projetor.",
    });
    return steps;
  }, [lesson]);

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
        <Link href={base} className="text-[var(--igh-primary)] hover:underline">
          ← Lista de aulas
        </Link>
      </div>
    );
  }

  const teacherControlsVisible = !studentPreview;

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-10 pt-1 sm:gap-5">
      <DashboardTutorial
        showForStudent
        steps={tutorialSteps}
        storageKey="professor-apresentar-aula-tutorial-done"
      />

      {/* Header mínimo — oculto em projeção fullscreen */}
      {!isContentFullscreen && (
        <header
          className="flex flex-col gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]/90 px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4"
          data-tour="prof-aula-header"
        >
          <div className="flex min-w-0 items-start gap-2 sm:items-center">
            <Link
              href={base}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--igh-primary)] transition hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              aria-label="Voltar ao índice de aulas"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-[var(--text-muted)]">
                <span className="text-[var(--igh-primary)]">{courseName}</span>
                {lesson.durationMinutes ? (
                  <>
                    <span aria-hidden> · </span>
                    <span>~{lesson.durationMinutes} min</span>
                  </>
                ) : null}
              </p>
              <h1 className="truncate text-base font-bold tracking-tight text-[var(--text-primary)] sm:text-lg">
                {lesson.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                studentPreview
                  ? "bg-sky-500/15 text-sky-900 dark:text-sky-200"
                  : "bg-[var(--igh-primary)]/15 text-[var(--igh-primary)]"
              }`}
              data-tour="prof-aula-acessivel"
            >
              {studentPreview ? "Preview aluno" : "Modo professor"}
            </span>

            {teacherControlsVisible && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    openSectionPanel("exercicios");
                    setQuizFullscreen(true);
                  }}
                  disabled={exercises.length === 0}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--card-border)] px-3 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--igh-surface)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                  title="Abrir quiz"
                >
                  <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">Quiz</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadKit}
                  disabled={!hasKit}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--card-border)] px-3 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--igh-surface)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                  title="Baixar kit da aula"
                >
                  <Download className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">Kit</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setStudentPreview((v) => !v)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                studentPreview
                  ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/10 text-[var(--igh-primary)]"
                  : "border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
              }`}
              aria-pressed={studentPreview}
              title={studentPreview ? "Sair do preview como aluno" : "Ver como aluno"}
            >
              {studentPreview ? (
                <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Eye className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span className="hidden sm:inline">{studentPreview ? "Sair preview" : "Como aluno"}</span>
            </button>

            <div className="relative" ref={toolsMenuRef} data-tour="prof-aula-ferramentas">
              <button
                type="button"
                onClick={() => {
                  setToolsOpen((v) => !v);
                  setCourseNavOpen(false);
                }}
                className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                  toolsOpen || openSection
                    ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/10 text-[var(--igh-primary)]"
                    : "border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                }`}
                aria-expanded={toolsOpen}
                aria-haspopup="menu"
              >
                <Wrench className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Ferramentas</span>
              </button>
              {toolsOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1.5 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      openSectionPanel("trechos");
                      setToolsOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                  >
                    <BookMarked className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
                    Trechos destacados
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      openSectionPanel("material");
                      setToolsOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
                    Material complementar
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      openSectionPanel("anotacoes");
                      setToolsOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                  >
                    <StickyNote className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
                    Anotações
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      openSectionPanel("exercicios");
                      setToolsOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                  >
                    <ClipboardList className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
                    Exercícios / quiz
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      openSectionPanel("duvidas");
                      setToolsOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                  >
                    <MessageCircleQuestion className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
                    Fórum
                    {questions.length > 0 ? (
                      <span className="ml-auto rounded-full bg-[var(--igh-primary)]/15 px-1.5 text-[10px] font-bold text-[var(--igh-primary)]">
                        {questions.length}
                      </span>
                    ) : null}
                  </button>
                  {lesson.summary?.trim() ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        openSectionPanel("resumo");
                        setToolsOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
                      Resumo da aula
                    </button>
                  ) : null}
                  {teacherControlsVisible && lesson.contentRich?.trim() ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setToolsOpen(false);
                        enterProjection();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                    >
                      <Presentation className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
                      Projetar somente slide
                    </button>
                  ) : null}
                  {teacherControlsVisible && hasKit ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setToolsOpen(false);
                        handleDownloadKit();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                    >
                      <Download className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
                      Baixar kit da aula
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            <div className="relative" ref={courseNavRef}>
              <button
                type="button"
                onClick={() => {
                  setCourseNavOpen((v) => !v);
                  setToolsOpen(false);
                }}
                className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                  courseNavOpen
                    ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/10 text-[var(--igh-primary)]"
                    : "border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                }`}
                aria-expanded={courseNavOpen}
                aria-haspopup="menu"
              >
                <MoreHorizontal className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Navegar</span>
              </button>
              {courseNavOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1.5 shadow-lg"
                >
                  {nav.prevLessonId ? (
                    <Link
                      role="menuitem"
                      href={`${base}/${nav.prevLessonId}`}
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                      onClick={() => setCourseNavOpen(false)}
                    >
                      <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> Aula anterior
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-muted)]">
                      <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> Aula anterior
                    </span>
                  )}
                  {nav.nextLessonId ? (
                    <Link
                      role="menuitem"
                      href={`${base}/${nav.nextLessonId}`}
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                      onClick={() => setCourseNavOpen(false)}
                    >
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> Próxima aula
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-muted)]">
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> Próxima aula
                    </span>
                  )}
                  <Link
                    role="menuitem"
                    href={base}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                    onClick={() => setCourseNavOpen(false)}
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden /> Índice de aulas
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Palco: vídeo + conteúdo */}
      <div className="flex flex-col gap-4">
        {lesson.videoUrl && !isContentFullscreen && (
          <section
            className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-black shadow-sm"
            aria-label="Vídeo da aula"
          >
            <div className="aspect-video w-full">
              <LessonVideoPlayer videoUrl={lesson.videoUrl} />
            </div>
          </section>
        )}

        {lesson.contentRich && lesson.contentRich.trim() ? (
          <div id="conteudo" className="scroll-mt-20" data-tour="prof-aula-conteudo">
            <div
              ref={contentWrapperRef}
              className={
                isContentFullscreen
                  ? "flex h-[100dvh] flex-col overflow-hidden bg-[var(--card-bg)]"
                  : "flex flex-col overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm"
              }
            >
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-1.5 border-b border-[var(--card-border)] px-3 py-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setContentFontSizePercent((p) => Math.max(50, p - 10))}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-50"
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
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-50"
                    title="Aumentar fonte"
                    aria-label="Aumentar fonte do texto"
                    disabled={contentFontSizePercent >= 200}
                  >
                    <Type className="mr-0.5 h-4 w-4" aria-hidden />
                    <Plus className="h-3 w-3" aria-hidden />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {!studentPreview && (
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent("highlightable-content-destacar"))}
                      disabled={savingPassage}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60"
                      title={savingPassage ? "Salvando..." : "Destacar trecho selecionado"}
                      aria-label={savingPassage ? "Salvando..." : "Destacar trecho selecionado"}
                    >
                      <Highlighter className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="hidden sm:inline">{savingPassage ? "Salvando..." : "Destacar"}</span>
                    </button>
                  )}
                  {!isContentFullscreen && (
                    <button
                      type="button"
                      onClick={enterProjection}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                      title="Projetar somente slide"
                      aria-label="Projetar somente slide em tela cheia"
                    >
                      <Maximize2 className="h-4 w-4" aria-hidden />
                      <span className="hidden sm:inline">Projetar slide</span>
                    </button>
                  )}
                </div>
              </div>

              <div
                className={`min-h-0 flex-1 overflow-auto px-4 py-4 ${isContentFullscreen ? "sm:px-8" : ""}`}
                style={{ minHeight: isContentFullscreen ? undefined : "12rem" }}
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
                    passages={passagesForCurrentPage}
                    onSavePassage={handleSavePassage}
                    onRemovePassage={studentPreview ? undefined : handleRemovePassage}
                    saving={savingPassage}
                    hideDestacarButton
                    onWarning={(msg) => toast.push("error", msg)}
                  />
                </div>
              </div>

              {(hasMultiplePages || isContentFullscreen) && (
                <nav
                  aria-label="Páginas do conteúdo"
                  className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-3"
                  style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
                >
                  {hasMultiplePages ? (
                    <>
                      <button
                        type="button"
                        onClick={() => goToSlide(contentPageIndex - 1)}
                        disabled={contentPageIndex === 0}
                        aria-label="Slide anterior"
                        className="inline-flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--igh-primary)]/40 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:flex-none sm:px-4"
                      >
                        <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
                        <span className="hidden sm:inline">Anterior</span>
                      </button>
                      <span className="shrink-0 px-2 text-sm font-medium text-[var(--text-muted)]">
                        {contentPageIndex + 1}/{contentPages.length}
                      </span>
                      {contentPageIndex === contentPages.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => goToSlide(0)}
                          aria-label="Primeiro slide"
                          className="inline-flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--igh-primary)]/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:flex-none sm:px-4"
                        >
                          <ChevronsLeft className="h-5 w-5 shrink-0" aria-hidden />
                          <span className="hidden sm:inline">Início</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => goToSlide(contentPageIndex + 1)}
                          aria-label="Próximo slide"
                          className="inline-flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--igh-primary)]/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:flex-none sm:px-4"
                        >
                          <span className="hidden sm:inline">Próximo</span>
                          <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="flex-1" aria-hidden />
                  )}
                  {isContentFullscreen && (
                    <button
                      type="button"
                      onClick={() => void document.exitFullscreen()}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--igh-primary)]/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                      title="Sair da projeção"
                      aria-label="Sair da tela cheia"
                    >
                      <Minimize2 className="h-4 w-4" aria-hidden />
                      <span className="hidden sm:inline">Sair</span>
                    </button>
                  )}
                </nav>
              )}
            </div>
          </div>
        ) : !lesson.videoUrl ? (
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            Esta aula ainda não tem vídeo nem conteúdo principal cadastrado.
          </div>
        ) : null}
      </div>

      {/* Ferramentas sob demanda */}
      {!isContentFullscreen && (
        <div id="ferramentas" className="scroll-mt-24">
          {openSection && (
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Ferramentas da aula
              </p>
              <button
                type="button"
                onClick={closeSectionPanel}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--igh-surface)] hover:text-[var(--text-primary)]"
                aria-label="Fechar painel"
              >
                <X className="h-3.5 w-3.5" aria-hidden /> Fechar
              </button>
            </div>
          )}

          {openSection && (
            <div
              className={`scroll-mt-24 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/95 p-4 shadow-sm sm:p-5 ${
                quizFullscreen && openSection === "exercicios"
                  ? "fixed inset-0 z-50 overflow-y-auto rounded-none border-0 p-6"
                  : ""
              }`}
            >
              {quizFullscreen && openSection === "exercicios" && (
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Quiz da aula</h2>
                  <button
                    type="button"
                    onClick={() => setQuizFullscreen(false)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--card-border)] px-3 text-sm font-medium hover:bg-[var(--igh-surface)]"
                  >
                    <Minimize2 className="h-4 w-4" aria-hidden /> Sair da tela limpa
                  </button>
                </div>
              )}

              {openSection === "resumo" && (
                <div>
                  <h2 className="mb-2 text-base font-semibold text-[var(--text-primary)]">Resumo da aula</h2>
                  {lesson.summary?.trim() ? (
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
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">Sem resumo cadastrado.</p>
                  )}
                </div>
              )}

              {openSection === "trechos" && (
                <div>
                  <h2 className="mb-2 text-base font-semibold text-[var(--text-primary)]">
                    Trechos destacados da aula
                  </h2>
                  {passages.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">
                      Nenhum trecho destacado ainda. Selecione texto no conteúdo e use Destacar.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {passagesByPage.map((group) => (
                        <div
                          key={group.pageIndex}
                          className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/30"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--card-border)] px-3 py-2">
                            <div className="text-sm font-semibold text-[var(--text-primary)]">
                              {hasMultiplePages ? `Slide ${group.pageIndex + 1}` : "Aula"}
                            </div>
                            {hasMultiplePages && (
                              <button
                                type="button"
                                onClick={() => goToSlide(group.pageIndex)}
                                className="text-sm font-medium text-[var(--igh-primary)] hover:underline"
                              >
                                Ir para o slide
                              </button>
                            )}
                          </div>
                          <ul className="divide-y divide-[var(--card-border)]">
                            {group.items.map((p) => (
                              <li
                                key={p.id}
                                className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm text-[var(--text-primary)]">{p.text}</p>
                                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                                    {p.createdAt
                                      ? new Date(p.createdAt).toLocaleString("pt-BR")
                                      : "Sem data"}
                                  </p>
                                </div>
                                {!studentPreview && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePassage(p.id)}
                                    className="inline-flex items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-[var(--igh-surface)] dark:text-red-400"
                                  >
                                    Remover
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {openSection === "material" && (
                <div>
                  <h2 className="mb-1 text-base font-semibold text-[var(--text-primary)]">
                    Material complementar
                  </h2>
                  <p className="mb-4 text-xs text-[var(--text-muted)]">
                    PDF e arquivos de apoio desta aula.
                  </p>
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

                  {teacherControlsVisible && (
                    <div className="mt-6 border-t border-[var(--card-border)] pt-4">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        Anexar novo material
                      </h3>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Fica disponível para os alunos (aceita qualquer tipo de arquivo).
                      </p>
                      <div className="mt-3 flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-medium text-[var(--text-primary)]">
                            Nome exibido (opcional)
                          </label>
                          <input
                            value={attachmentDisplayName}
                            onChange={(e) => setAttachmentDisplayName(e.target.value)}
                            placeholder="Ex.: Planilha de exercícios"
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
                      </div>
                    </div>
                  )}
                </div>
              )}

              {openSection === "anotacoes" && (
                <div>
                  <h2 className="mb-1 text-base font-semibold text-[var(--text-primary)]">
                    Bloco de anotações
                  </h2>
                  <p className="mb-4 text-xs text-[var(--text-muted)]">
                    Anotações pessoais para esta aula (salvas neste navegador).
                  </p>
                  {!studentPreview && (
                    <div className="mb-4 flex flex-col gap-3">
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
                    </div>
                  )}
                  {notes.length > 0 ? (
                    <div className="space-y-2">
                      {notes.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/20 p-3"
                        >
                          <p className="text-xs text-[var(--text-muted)]">
                            {new Date(n.createdAt).toLocaleString("pt-BR")}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-primary)]">
                            {n.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">Nenhuma anotação ainda.</p>
                  )}
                </div>
              )}

              {openSection === "duvidas" && (
                <div>
                  <h2 className="mb-1 text-base font-semibold text-[var(--text-primary)]">Fórum da aula</h2>
                  <p className="mb-4 text-xs text-[var(--text-muted)]">
                    Dúvidas dos alunos nesta aula.
                  </p>
                  {loadingQuestions ? (
                    <p className="text-sm text-[var(--text-muted)]">Carregando fórum…</p>
                  ) : questions.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">Nenhuma dúvida nesta aula ainda.</p>
                  ) : (
                    <div className="space-y-4">
                      {questions.map((q) => (
                        <div
                          key={q.id}
                          className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/10 p-4"
                        >
                          <p className="text-xs font-semibold text-[var(--text-muted)]">
                            {q.authorName} · {new Date(q.createdAt).toLocaleString("pt-BR")}
                          </p>
                          <ForumPostBody
                            content={q.content}
                            imageUrls={q.imageUrls}
                            altPrefix={`Foto de ${q.authorName}`}
                            className="mt-2"
                          />
                          {q.teacherReplies?.length > 0 && (
                            <div className="mt-3 space-y-3 border-l border-[var(--card-border)] pl-3">
                              {q.teacherReplies.map((r) => (
                                <div key={r.id}>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    {r.teacherName} · {new Date(r.createdAt).toLocaleString("pt-BR")}
                                  </p>
                                  <ForumPostBody
                                    content={r.content}
                                    altPrefix={`Foto de ${r.teacherName}`}
                                    className="mt-1"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          {teacherControlsVisible && (
                            <div className="mt-4">
                              <ForumPostComposer
                                content={replyContentByQuestionId[q.id] ?? ""}
                                onContentChange={(value) =>
                                  setReplyContentByQuestionId((prev) => ({ ...prev, [q.id]: value }))
                                }
                                imageUrls={replyImageUrlsByQuestionId[q.id] ?? []}
                                onImageUrlsChange={(urls) =>
                                  setReplyImageUrlsByQuestionId((prev) => ({ ...prev, [q.id]: urls }))
                                }
                                onSubmit={() => void handleReply(q.id)}
                                submitting={replyingQuestionId === q.id}
                                submitLabel="Responder"
                                placeholder="Sua resposta (rich text, opcional)…"
                                minEditorHeight="120px"
                                uploadSignaturePath={TEACHER_FORUM_UPLOAD}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {openSection === "exercicios" && (
                <div>
                  {!quizFullscreen && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-base font-semibold text-[var(--text-primary)]">Exercícios</h2>
                        <p className="text-xs text-[var(--text-muted)]">
                          Os alunos respondem na área deles. Use o gabarito quando precisar.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {teacherControlsVisible && exercises.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowExerciseAnswers((v) => !v)}
                            className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--card-bg)] sm:text-sm"
                          >
                            {showExerciseAnswers ? "Ocultar respostas" : "Exibir respostas"}
                          </button>
                        )}
                        {teacherControlsVisible && exercises.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setQuizFullscreen(true)}
                            className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--card-bg)] sm:text-sm"
                          >
                            Tela limpa
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {teacherControlsVisible && quizFullscreen && exercises.length > 0 && (
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={() => setShowExerciseAnswers((v) => !v)}
                        className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--card-bg)]"
                      >
                        {showExerciseAnswers ? "Ocultar respostas" : "Exibir respostas"}
                      </button>
                    </div>
                  )}
                  {exercises.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">Não há exercícios nesta aula.</p>
                  ) : (
                    <div className="space-y-6">
                      {exercises.map((ex, exIdx) => (
                        <div
                          key={ex.id}
                          className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/20 p-4"
                        >
                          <p className="text-xs font-semibold text-[var(--text-muted)]">
                            Questão {exIdx + 1}
                          </p>
                          <p className="mt-1 font-medium text-[var(--text-primary)]">{ex.question}</p>
                          <ul className="mt-3 list-none space-y-1.5 p-0">
                            {ex.options.map((o) => {
                              const reveal = !studentPreview && showExerciseAnswers && o.isCorrect;
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
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
