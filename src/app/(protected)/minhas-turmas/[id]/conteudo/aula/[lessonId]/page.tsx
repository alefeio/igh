"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ClipboardList,
  FileText,
  Highlighter,
  History,
  Maximize2,
  MessageCircleQuestion,
  Minimize2,
  Minus,
  MoreHorizontal,
  Plus,
  StickyNote,
  Type,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { DashboardTutorial, type TutorialStep } from "@/components/dashboard/DashboardTutorial";
import { SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { ForumPostBody } from "@/components/forum/ForumPostBody";
import { ForumPostComposer } from "@/components/forum/ForumPostComposer";
import { useUser } from "@/components/layout/UserProvider";
import { HighlightableContentViewer, type LessonPassage } from "@/components/lesson/HighlightableContentViewer";
import { LessonVideoPlayer } from "@/components/lesson/LessonVideoPlayer";
import type { ApiResponse } from "@/lib/api-types";
import { isForumPostEmpty } from "@/lib/forum-question-content";

type LessonProgress = {
  completed: boolean;
  percentWatched: number;
  percentRead: number;
  completedAt: string | null;
  lastAccessedAt: string | null;
  totalMinutesStudied: number;
  lastContentPageIndex: number | null;
};

type LessonNote = {
  id: string;
  content: string;
  videoTimestampSecs: number | null;
  videoTimestampLabel: string | null;
  createdAt: string;
};

type Lesson = {
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
  attachmentNames?: string[];
  isLiberada: boolean;
};

type Module = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessons: Lesson[];
};

function findLesson(modules: Module[], lessonId: string): { lesson: Lesson; moduleTitle: string } | null {
  for (const mod of modules) {
    const lesson = mod.lessons.find((l) => l.id === lessonId);
    if (lesson) return { lesson, moduleTitle: mod.title };
  }
  return null;
}

/** Lista de aulas na ordem do curso (módulos e aulas ordenados). */
function getOrderedLessons(modules: Module[]): Lesson[] {
  return modules.flatMap((m) => m.lessons);
}

/** Nome amigável para o link: usa o nome definido pelo professor ou extrai da URL. */
function getAttachmentLabel(url: string, index: number, customName?: string): string {
  const trimmed = customName?.trim();
  if (trimmed && trimmed.length > 0) return trimmed;
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split("/").filter(Boolean).pop();
    if (name && name.length > 0) return decodeURIComponent(name);
  } catch {}
  return `Arquivo de apoio ${index + 1}`;
}

/** Divide o HTML do conteúdo em páginas separadas por cada título H1. Retorna HTML e offset de cada seção no texto original. */
function splitContentByH1(html: string): { html: string; startOffset: number }[] {
  const trimmed = (html || "").trim();
  if (!trimmed) return [];
  const regex = /<h1(?:\s[^>]*)?>/gi;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(trimmed)) !== null) indices.push(m.index);
  if (indices.length === 0) return [{ html: trimmed, startOffset: 0 }];
  const sections: { html: string; startOffset: number }[] = [];
  if (indices[0]! > 0) sections.push({ html: trimmed.slice(0, indices[0]!), startOffset: 0 });
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]!;
    const end = indices[i + 1] ?? trimmed.length;
    sections.push({ html: trimmed.slice(start, end), startOffset: start });
  }
  return sections;
}

/** Botão que baixa o PDF da aula via fetch + blob para evitar erro "site não disponível" no navegador. */
function PdfDownloadButton({
  enrollmentId,
  lessonId,
  lessonTitle,
}: {
  enrollmentId: string;
  lessonId: string;
  lessonTitle: string;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const pdfUrl = `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/pdf`;

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(pdfUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao gerar PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename = `aula-${lessonTitle.slice(0, 30).replace(/[^a-zA-Z0-9\u00C0-\u00FF\-]/g, "-")}.pdf`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.push("error", "Não foi possível baixar o PDF. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex max-w-fit items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-medium text-[var(--igh-primary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60"
    >
      <span aria-hidden>📄</span>
      {loading ? "Gerando PDF…" : "PDF da aula"}
    </button>
  );
}

export default function AulaConteudoPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const enrollmentId = params?.id as string;
  const lessonId = params?.lessonId as string;
  const toast = useToast();
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ courseName: string; modules: Module[] } | null>(null);
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [notes, setNotes] = useState<LessonNote[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [noteVideoMinute, setNoteVideoMinute] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [passages, setPassages] = useState<LessonPassage[]>([]);
  const [savingPassage, setSavingPassage] = useState(false);
  const [removingPassageId, setRemovingPassageId] = useState<string | null>(null);
  type ExerciseOption = { id: string; text: string };
  type LessonExercise = {
    id: string;
    order: number;
    question: string;
    answerJustification?: string | null;
    options: ExerciseOption[];
  };
  const [exercises, setExercises] = useState<LessonExercise[]>([]);
  const [exerciseSelected, setExerciseSelected] = useState<Record<string, string>>({});
  const [exerciseResult, setExerciseResult] = useState<Record<string, { correct: boolean; correctOptionId: string | null }>>({});
  const [submittingExerciseId, setSubmittingExerciseId] = useState<string | null>(null);
  const [submittingAllExercises, setSubmittingAllExercises] = useState(false);
  type LessonQuestionReply = { id: string; content: string; createdAt: string; enrollmentId: string; authorName: string };
  type LessonTeacherReply = { id: string; content: string; createdAt: string; teacherName: string };
  type LessonQuestion = {
    id: string;
    content: string;
    imageUrls?: string[];
    createdAt: string;
    updatedAt?: string;
    enrollmentId: string;
    authorName: string;
    replies?: LessonQuestionReply[];
    teacherReplies?: LessonTeacherReply[];
  };
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [questionContent, setQuestionContent] = useState("");
  const [questionImageUrls, setQuestionImageUrls] = useState<string[]>([]);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [removingQuestionId, setRemovingQuestionId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionContent, setEditQuestionContent] = useState("");
  const [editQuestionImageUrls, setEditQuestionImageUrls] = useState<string[]>([]);
  const [savingEditQuestionId, setSavingEditQuestionId] = useState<string | null>(null);
  const [replyingToQuestionId, setReplyingToQuestionId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [savingReplyQuestionId, setSavingReplyQuestionId] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [courseNavOpen, setCourseNavOpen] = useState(false);
  const [progressDetailsOpen, setProgressDetailsOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const courseNavRef = useRef<HTMLDivElement>(null);
  const SECTION_KEYS = ["trechos", "material", "anotacoes", "exercicios", "duvidas"] as const;
  type SectionKey = (typeof SECTION_KEYS)[number];
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const [loadedSections, setLoadedSections] = useState<Record<SectionKey, boolean>>({
    trechos: false,
    material: false,
    anotacoes: false,
    exercicios: false,
    duvidas: false,
  });
  const sectionPanelRef = useRef<HTMLDivElement>(null);
  /** Índice inicial quando a URL ainda não tem ?pagina= (antes de restaurar do progresso). */
  const [initialSlideIndex, setInitialSlideIndex] = useState(0);
  const contentPageIndexRef = useRef(0);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const [isContentFullscreen, setIsContentFullscreen] = useState(false);
  const [contentFontSizePercent, setContentFontSizePercent] = useState(100);
  const hasSetUrlFromProgressRef = useRef(false);
  const hasAutoCompletedOnLastSlideRef = useRef(false);
  /** null = ainda verificando; true/false = resultado do bootstrap (sem carregar enunciados). */
  const [prevLessonExercisesComplete, setPrevLessonExercisesComplete] = useState<boolean | null>(null);
  /** Status leve dos exercícios desta aula (bootstrap); atualizado ao carregar/responder a seção. */
  const [currentLessonExercisesComplete, setCurrentLessonExercisesComplete] = useState(true);

  /**
   * Progresso da aula: este endpoint era chamado muitas vezes (slide change, visibilitychange, unload etc.).
   * Para reduzir carga/conexões, fazemos merge de updates e limitamos a frequência de PATCH.
   */
  const PROGRESS_PATCH_MIN_INTERVAL_MS = 15_000;
  const pendingProgressPatchRef = useRef<
    | {
        completed?: boolean;
        percentWatched?: number;
        percentRead?: number;
        studyMinutesDelta?: number;
        lastContentPageIndex?: number | null;
      }
    | null
  >(null);
  const progressPatchTimerRef = useRef<number | null>(null);
  const progressPatchLastSentAtRef = useRef<number>(0);

  const flushProgressPatch = useCallback(
    async (opts?: { immediate?: boolean; preferBeacon?: boolean }) => {
      if (!enrollmentId || !lessonId) return;
      const payload = pendingProgressPatchRef.current;
      if (!payload) return;

      const now = Date.now();
      const immediate = opts?.immediate === true;
      const preferBeacon = opts?.preferBeacon === true;
      const elapsed = now - progressPatchLastSentAtRef.current;
      if (!immediate && elapsed < PROGRESS_PATCH_MIN_INTERVAL_MS) return;

      pendingProgressPatchRef.current = null;
      progressPatchLastSentAtRef.current = now;

      const url = `/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`;
      const body = JSON.stringify(payload);

      if (preferBeacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        try {
          navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
          return;
        } catch {
          // fallback para fetch abaixo
        }
      }

      try {
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
        if (res.ok) {
          const json = (await res.json()) as ApiResponse<LessonProgress>;
          if (json?.ok && json.data) setProgress(json.data);
        }
      } catch {
        // ignore
      }
    },
    [enrollmentId, lessonId]
  );

  const queueProgressPatch = useCallback(
    (partial: NonNullable<typeof pendingProgressPatchRef.current>, opts?: { immediate?: boolean }) => {
      if (!enrollmentId || !lessonId) return;
      pendingProgressPatchRef.current = { ...(pendingProgressPatchRef.current ?? {}), ...partial };

      if (progressPatchTimerRef.current != null) window.clearTimeout(progressPatchTimerRef.current);
      const immediate = opts?.immediate === true;
      const wait = immediate
        ? 0
        : Math.max(0, PROGRESS_PATCH_MIN_INTERVAL_MS - (Date.now() - progressPatchLastSentAtRef.current));
      progressPatchTimerRef.current = window.setTimeout(() => {
        progressPatchTimerRef.current = null;
        void flushProgressPatch({ immediate });
      }, wait);
    },
    [enrollmentId, lessonId, flushProgressPatch]
  );

  /** Abre/fecha ferramenta de estudo e atualiza a URL (?secao= e #ferramentas). */
  const openSectionPanel = useCallback(
    (key: SectionKey) => {
      const willClose = openSection === key;
      const next: SectionKey | null = willClose ? null : key;
      setOpenSection(next);
      if (next) {
        setToolsOpen(false);
        setCourseNavOpen(false);
        setProgressDetailsOpen(false);
      }
      const path = `/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}`;
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("secao", next);
      else params.delete("secao");
      const qs = params.toString();
      const hash = next ? "#ferramentas" : "";
      router.replace(qs ? `${path}?${qs}${hash}` : `${path}${hash}`);
      if (next) {
        setTimeout(() => {
          document.getElementById("ferramentas")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    },
    [enrollmentId, lessonId, openSection, router, searchParams]
  );

  /** Ao carregar ou quando a URL mudar, abre a seção indicada por ?secao= */
  useEffect(() => {
    const secao = searchParams.get("secao");
    const valid = SECTION_KEYS.includes(secao as SectionKey) ? (secao as SectionKey) : null;
    if (valid) {
      setOpenSection(valid);
      setCourseNavOpen(false);
      setProgressDetailsOpen(false);
    } else if (secao !== null) {
      setOpenSection(null);
    }
  }, [searchParams]);

  /** Ao abrir uma seção, rola até a âncora das ferramentas. */
  useEffect(() => {
    if (openSection) {
      const t = setTimeout(() => {
        document.getElementById("ferramentas")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      return () => clearTimeout(t);
    }
  }, [openSection]);

  /** Fecha menus ao clicar fora. */
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

  const loadPassages = useCallback(async () => {
    if (!enrollmentId || !lessonId) return;
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/passages`
      );
      const json = (await res.json()) as ApiResponse<
        { id: string; text: string; startOffset: number; createdAt: string }[]
      >;
      if (res.ok && json?.ok) setPassages(json.data);
      else setPassages([]);
    } catch {
      setPassages([]);
    }
  }, [enrollmentId, lessonId]);

  useEffect(() => {
    setInitialSlideIndex(0);
    hasSetUrlFromProgressRef.current = false;
    hasAutoCompletedOnLastSlideRef.current = false;
    setLoadedSections({
      trechos: false,
      material: false,
      anotacoes: false,
      exercicios: false,
      duvidas: false,
    });
    setExercises([]);
    setExerciseSelected({});
    setExerciseResult({});
    setPassages([]);
    setNotes([]);
    setQuestions([]);
    setOpenSection(null);
  }, [lessonId]);

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsContentFullscreen(!!document.fullscreenElement && document.fullscreenElement === contentWrapperRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEBUG_SCROLL !== "1") return;
    console.log(
      "Página da aula montada. Abra o DevTools (F12) > aba Console e role a página para ver 'SCROLL ATIVADO'."
    );
    return () => console.log("Página da aula desmontada.");
  }, []);

  useEffect(() => {
    if (!enrollmentId || !lessonId) return;
    async function load() {
      setLoading(true);
      setPrevLessonExercisesComplete(null);
      try {
        const res = await fetch(
          `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/bootstrap`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as ApiResponse<{
          courseName: string;
          modules: {
            id: string;
            title: string;
            description: string | null;
            order: number;
            lessons: {
              id: string;
              title: string;
              order: number;
              durationMinutes: number | null;
              videoUrl: string | null;
              isLiberada: boolean;
              completed: boolean;
              lastContentPageIndex: number | null;
            }[];
          }[];
          lesson: {
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
            isLiberada: boolean;
          };
          progress: LessonProgress;
          favorite: boolean;
          currentLessonExercisesComplete: boolean;
          prevLessonExercisesComplete: boolean;
        }>;

        if (!res.ok || !json?.ok) {
          toast.push(
            "error",
            json && "error" in json ? json.error.message : "Aula não disponível."
          );
          return;
        }

        const { courseName, modules, lesson: details, progress: prog, favorite } = json.data;
        setData({
          courseName,
          modules: modules.map((m) => ({
            ...m,
            lessons: m.lessons.map((l) => {
              const base: Lesson = {
                ...l,
                contentRich: null,
                summary: null,
                imageUrls: [],
                pdfUrl: null,
                attachmentUrls: [],
                attachmentNames: [],
              };
              return l.id === details.id ? ({ ...base, ...details } satisfies Lesson) : base;
            }),
          })),
        });
        setProgress(prog);
        setIsFavorite(favorite);
        setCurrentLessonExercisesComplete(json.data.currentLessonExercisesComplete);
        setPrevLessonExercisesComplete(json.data.prevLessonExercisesComplete);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [enrollmentId, lessonId, toast]);

  const loadNotes = useCallback(async () => {
    if (!enrollmentId || !lessonId) return;
    try {
      const res = await fetch(`/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/notes`);
      const json = (await res.json()) as ApiResponse<LessonNote[]>;
      if (res.ok && json?.ok) setNotes(json.data);
    } catch {
      setNotes([]);
    }
  }, [enrollmentId, lessonId]);

  const loadExercises = useCallback(async () => {
    if (!enrollmentId || !lessonId) return;
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/exercises`
      );
      const json = (await res.json()) as ApiResponse<{
        exercises: { id: string; order: number; question: string; answerJustification?: string | null; options: { id: string; text: string; order: number }[] }[];
        answers: { exerciseId: string; selectedOptionId: string; correct: boolean; correctOptionId: string | null }[];
      }>;
      if (res.ok && json?.ok && json.data) {
        setExercises(json.data.exercises);
        const selected: Record<string, string> = {};
        const result: Record<string, { correct: boolean; correctOptionId: string | null }> = {};
        for (const a of json.data.answers) {
          selected[a.exerciseId] = a.selectedOptionId;
          result[a.exerciseId] = { correct: a.correct, correctOptionId: a.correctOptionId };
        }
        setExerciseSelected(selected);
        setExerciseResult(result);
        const allAnswered =
          json.data.exercises.length === 0 ||
          json.data.exercises.every((ex) => result[ex.id] != null);
        setCurrentLessonExercisesComplete(allAnswered);
      } else {
        setExercises([]);
        setCurrentLessonExercisesComplete(true);
      }
    } catch {
      setExercises([]);
    }
  }, [enrollmentId, lessonId]);

  const loadQuestions = useCallback(async () => {
    if (!enrollmentId || !lessonId) return;
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/questions`
      );
      const json = (await res.json()) as ApiResponse<LessonQuestion[]>;
      if (res.ok && json?.ok) setQuestions(json.data);
      else setQuestions([]);
    } catch {
      setQuestions([]);
    }
  }, [enrollmentId, lessonId]);

  useEffect(() => {
    if (!openSection || loadedSections[openSection]) return;
    if (openSection === "trechos") {
      loadPassages().then(() => setLoadedSections((p) => ({ ...p, trechos: true })));
    } else if (openSection === "anotacoes") {
      loadNotes().then(() => setLoadedSections((p) => ({ ...p, anotacoes: true })));
    } else if (openSection === "exercicios") {
      loadExercises().then(() => setLoadedSections((p) => ({ ...p, exercicios: true })));
    } else if (openSection === "duvidas") {
      loadQuestions().then(() => setLoadedSections((p) => ({ ...p, duvidas: true })));
    } else if (openSection === "material") {
      setLoadedSections((p) => ({ ...p, material: true }));
    }
  }, [openSection, loadedSections, loadPassages, loadNotes, loadExercises, loadQuestions]);

  /** Ao sair da aula, envia tempo de estudo (último acesso já foi tocado no bootstrap). */
  useEffect(() => {
    if (!enrollmentId || !lessonId || !data?.modules) return;
    const lesson = findLesson(data.modules, lessonId)?.lesson;
    if (!lesson?.isLiberada) return;

    const startMs = Date.now();

    const sendStudyTime = (minutes: number) => {
      if (minutes <= 0) return;
      queueProgressPatch(
        {
          percentWatched: progress?.percentWatched ?? 0,
          percentRead: progress?.percentRead ?? 0,
          studyMinutesDelta: minutes,
          lastContentPageIndex: contentPageIndexRef.current,
        },
        { immediate: true }
      );
      const body = JSON.stringify(pendingProgressPatchRef.current ?? {
        percentWatched: progress?.percentWatched ?? 0,
        percentRead: progress?.percentRead ?? 0,
        studyMinutesDelta: minutes,
        lastContentPageIndex: contentPageIndexRef.current,
      });
      navigator.sendBeacon(
        `/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`,
        new Blob([body], { type: "application/json" })
      );
    };

    const onUnload = () => {
      const minutes = Math.floor((Date.now() - startMs) / 60_000);
      sendStudyTime(minutes);
    };

    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      const minutes = Math.floor((Date.now() - startMs) / 60_000);
      if (minutes > 0) {
        queueProgressPatch(
          {
            percentWatched: progress?.percentWatched ?? 0,
            percentRead: progress?.percentRead ?? 0,
            studyMinutesDelta: minutes,
            lastContentPageIndex: contentPageIndexRef.current,
          },
          { immediate: true }
        );
        void flushProgressPatch({ immediate: true, preferBeacon: true });
      }
    };
  }, [enrollmentId, lessonId, data?.modules, flushProgressPatch, progress?.percentRead, progress?.percentWatched, queueProgressPatch]);

  // Só observar o header quando estamos de fato renderizando o card da aula.
  // Se dependermos só de [data, lessonId], o effect pode rodar quando data existe
  // mas a tela mostra "Aula não encontrada" (ref ainda null) e não roda de novo.
  const foundForEffect = data ? findLesson(data.modules, lessonId) : null;
  const showLessonCard = !!(foundForEffect && foundForEffect.lesson.isLiberada);
  const lessonForContent = foundForEffect?.lesson;
  const contentPages = useMemo(() => {
    const sections = splitContentByH1(lessonForContent?.contentRich ?? "");
    if (typeof document === "undefined") return sections.map((s) => ({ ...s, textLength: 0 }));
    return sections.map((s) => {
      const div = document.createElement("div");
      div.innerHTML = s.html;
      return { ...s, textLength: div.textContent?.length ?? 0 };
    });
  }, [lessonForContent?.contentRich]);
  const hasMultiplePages = contentPages.length > 1;
  const totalPages = contentPages.length;

  /** Índice do slide a partir da URL (?pagina= é 1-based). Quando não há pagina na URL, usa initialSlideIndex. */
  const paginaParam = searchParams.get("pagina");
  const parsedPagina = paginaParam != null ? parseInt(paginaParam, 10) : NaN;
  const contentPageIndexFromUrl =
    hasMultiplePages && totalPages > 0 && !Number.isNaN(parsedPagina)
      ? Math.max(0, Math.min(totalPages - 1, parsedPagina - 1))
      : null;
  const contentPageIndex = hasMultiplePages
    ? (contentPageIndexFromUrl ?? initialSlideIndex)
    : 0;

  const currentContentSection = contentPages[contentPageIndex];

  /** Quando não há ?pagina= na URL, define a partir do progresso e atualiza a URL (uma vez por aula). */
  useEffect(() => {
    if (
      !hasMultiplePages ||
      hasSetUrlFromProgressRef.current ||
      progress?.lastContentPageIndex == null ||
      totalPages === 0 ||
      searchParams.get("pagina") != null
    )
      return;
    const saved = Math.max(0, Math.min(progress.lastContentPageIndex, totalPages - 1));
    hasSetUrlFromProgressRef.current = true;
    setInitialSlideIndex(saved);
    const path = `/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}`;
    router.replace(`${path}?pagina=${saved + 1}`);
  }, [progress?.lastContentPageIndex, totalPages, hasMultiplePages, enrollmentId, lessonId, router, searchParams]);

  contentPageIndexRef.current = contentPageIndex;

  /** Em tela cheia, volta ao topo do painel ao mudar de slide (?pagina=). */
  useLayoutEffect(() => {
    if (!hasMultiplePages) return;
    const wrap = contentWrapperRef.current;
    if (!wrap || document.fullscreenElement !== wrap) return;
    wrap.scrollTop = 0;
    wrap.querySelectorAll(".overflow-auto, .overflow-y-auto").forEach((node) => {
      (node as HTMLElement).scrollTop = 0;
    });
  }, [contentPageIndex, hasMultiplePages]);

  /** Persiste o índice do slide no backend (reutilizado nos botões e ao sair/ocultar). */
  const persistSlideIndex = useCallback(
    (index: number, from: string) => {
      if (!enrollmentId || !lessonId || progress?.completed) return;
      console.log("[Slide] Enfileirando persistência:", { momento: from, indice: index, paginaExibida: index + 1 });
      queueProgressPatch({ lastContentPageIndex: index });
    },
    [enrollmentId, lessonId, progress?.completed, queueProgressPatch]
  );

  const gotoPrevSlide = useCallback(() => {
    if (!hasMultiplePages) return;
    const cur = contentPageIndexRef.current;
    if (cur <= 0) return;
    const prev = Math.max(0, cur - 1);
    persistSlideIndex(prev, "tecla ArrowLeft");
    router.replace(`/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}?pagina=${prev + 1}#conteudo`);
    setTimeout(() => contentWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, [enrollmentId, lessonId, hasMultiplePages, persistSlideIndex, router]);

  const gotoNextSlide = useCallback(() => {
    if (!hasMultiplePages) return;
    const cur = contentPageIndexRef.current;
    const last = totalPages - 1;
    if (cur >= last) return;
    const next = Math.min(last, cur + 1);
    persistSlideIndex(next, "tecla ArrowRight");
    router.replace(`/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}?pagina=${next + 1}#conteudo`);
    setTimeout(() => contentWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, [enrollmentId, lessonId, hasMultiplePages, persistSlideIndex, router, totalPages]);

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

      // Evita rolagem da página quando usar as setas.
      e.preventDefault();

      if (e.key === "ArrowLeft") gotoPrevSlide();
      else gotoNextSlide();
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasMultiplePages, gotoPrevSlide, gotoNextSlide]);

  /** A cada slide exibido (URL com ?pagina=), persiste no banco. Ao ocultar aba ou sair, persiste também. */
  useEffect(() => {
    if (!enrollmentId || !lessonId || !hasMultiplePages || progress?.completed) return;
    const apiUrl = `/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`;
    const sendBeaconPersist = (index: number) => {
      console.log("[Slide] Salvando no banco (sendBeacon):", { indice: index, paginaExibida: index + 1 });
      const blob = new Blob([JSON.stringify({ lastContentPageIndex: index })], {
        type: "application/json",
      });
      navigator.sendBeacon(apiUrl, blob);
    };
    if (searchParams.get("pagina") != null) {
      console.log("[Slide] Efeito: URL tem pagina=, persistindo índice", contentPageIndex);
      persistSlideIndex(contentPageIndex, "efeito (URL com pagina)");
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        console.log("[Slide] Aba oculta, enviando (beacon) índice", contentPageIndexRef.current);
        sendBeaconPersist(contentPageIndexRef.current);
      }
    };
    const onPageHide = () => {
      console.log("[Slide] pagehide, sendBeacon índice", contentPageIndexRef.current);
      sendBeaconPersist(contentPageIndexRef.current);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      console.log("[Slide] Cleanup: sendBeacon índice", contentPageIndexRef.current);
      sendBeaconPersist(contentPageIndexRef.current);
    };
  }, [contentPageIndex, hasMultiplePages, enrollmentId, lessonId, progress?.completed, searchParams, persistSlideIndex]);

  /** Ao chegar no último slide, marca a aula como concluída e atualiza o estado (Em andamento → Concluída). */
  useEffect(() => {
    if (
      !enrollmentId ||
      !lessonId ||
      !hasMultiplePages ||
      totalPages === 0 ||
      contentPageIndex !== totalPages - 1 ||
      progress?.completed ||
      hasAutoCompletedOnLastSlideRef.current
    )
      return;
    hasAutoCompletedOnLastSlideRef.current = true;
    const url = `/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`;
    queueProgressPatch(
      { completed: true, lastContentPageIndex: contentPageIndex },
      { immediate: true }
    );
    void flushProgressPatch({ immediate: true })
      .then(() => {
        toast.push("success", "Aula marcada como concluída.");
      })
      .catch(() => {
        hasAutoCompletedOnLastSlideRef.current = false;
        toast.push("error", "Não foi possível atualizar o status da aula.");
      });
  }, [contentPageIndex, totalPages, hasMultiplePages, enrollmentId, lessonId, progress?.completed, toast]);

  const contentToShow = hasMultiplePages && currentContentSection ? currentContentSection.html : (lessonForContent?.contentRich ?? "");
  const passagesForCurrentPage = useMemo(() => {
    if (!hasMultiplePages || !currentContentSection) return passages;
    const { startOffset, textLength } = currentContentSection;
    return passages
      .filter((p) => p.startOffset >= startOffset && p.startOffset + p.text.length <= startOffset + textLength)
      .map((p) => ({ ...p, startOffset: p.startOffset - startOffset }));
  }, [hasMultiplePages, currentContentSection, passages]);

  const handleSavePassage = useCallback(
    async (payload: { text: string; startOffset: number }) => {
      console.log("[Destacar] Salvando trecho na API.", { payload, enrollmentId, lessonId });
      setSavingPassage(true);
      try {
        const res = await fetch(
          `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/passages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: payload.text, startOffset: payload.startOffset }),
          }
        );
        const json = (await res.json()) as ApiResponse<{ id: string; text: string; startOffset: number; createdAt: string }>;
        console.log("[Destacar] Resposta da API.", { ok: res.ok, status: res.status, json });
        if (res.ok && json?.ok) {
          setPassages((prev) => [...prev, json.data]);
          toast.push("success", "Trecho destacado salvo.");
        } else {
          const errMsg = (json && "error" in json ? (json as { error?: { message?: string } }).error?.message : undefined) ?? "Não foi possível salvar o trecho.";
          toast.push("error", errMsg);
        }
      } catch (err) {
        console.error("[Destacar] Erro ao salvar trecho.", err);
        throw err;
      } finally {
        setSavingPassage(false);
      }
    },
    [enrollmentId, lessonId, toast]
  );

  const handleSavePassageForPage = useCallback(
    (payload: { text: string; startOffset: number }) => {
      console.log("[Destacar] handleSavePassageForPage chamado.", { payload, hasMultiplePages, currentContentSection: currentContentSection ?? null });
      if (hasMultiplePages && currentContentSection) {
        handleSavePassage({ text: payload.text, startOffset: payload.startOffset + currentContentSection.startOffset });
      } else {
        handleSavePassage(payload);
      }
    },
    [hasMultiplePages, currentContentSection, handleSavePassage]
  );

  // (barra flutuante de seções removida — ferramentas ficam no menu discreto)

  useEffect(() => {
    if (!showLessonCard) return;
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showLessonCard, lessonId]);

  // Debug (opt-in): logar scroll quando habilitado via env var (evita custo em produção).
  useEffect(() => {
    if (!showLessonCard) return;
    if (process.env.NEXT_PUBLIC_DEBUG_SCROLL !== "1") return;
    let lastLog = 0;
    const throttleMs = 400;
    const onScrollDebug = () => {
      const now = Date.now();
      if (now - lastLog >= throttleMs) {
        lastLog = now;
        console.log("SCROLL ATIVADO", {
          windowScrollY: window.scrollY,
          documentScrollTop: document.documentElement.scrollTop,
          documentBodyScrollTop: document.body.scrollTop,
        });
      }
    };
    console.log("SCROLL DEBUG ATIVO (NEXT_PUBLIC_DEBUG_SCROLL=1).");
    window.addEventListener("scroll", onScrollDebug, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScrollDebug);
    };
  }, [showLessonCard]);

  const tutorialSteps: TutorialStep[] = useMemo(() => {
    if (!data || !lessonId) return [];
    const found = findLesson(data.modules, lessonId);
    if (!found || !found.lesson.isLiberada) return [];
    const lesson = found.lesson;
    const contentPages = lesson.contentRich && lesson.contentRich.trim() ? splitContentByH1(lesson.contentRich) : [];
    const hasMultiplePages = contentPages.length > 1;
    const steps: TutorialStep[] = [
      {
        target: "[data-tour=\"aula-header\"]",
        title: "Sala de aula",
        content: "Aqui ficam o título da aula, favoritar, marcar como concluída e os menus de Ferramentas e Navegar no curso.",
      },
    ];
    if (lesson.videoUrl) {
      steps.push({
        target: "[data-tour=\"aula-video\"]",
        title: "Vídeo da aula",
        content: "Assista ao vídeo aqui. O progresso de visualização é salvo automaticamente.",
      });
    }
    if (lesson.contentRich && lesson.contentRich.trim()) {
      steps.push({
        target: "[data-tour=\"aula-conteudo\"]",
        title: "Conteúdo da aula",
        content: "Este é o material principal para estudo. Use fonte, destacar e tela cheia quando precisar.",
      });
      if (hasMultiplePages) {
        steps.push({
          target: "[data-tour=\"aula-slides\"]",
          title: "Navegação entre slides",
          content: "Os botões de slide ficam na barra inferior, perto dos dedos no celular — inclusive em tela cheia.",
        });
      }
    }
    steps.push(
      {
        target: "[data-tour=\"aula-ferramentas\"]",
        title: "Ferramentas",
        content: "Trechos, material, anotações, exercícios, fórum e progresso ficam neste menu, para não competir com o estudo.",
      },
      {
        target: null,
        title: "Tudo pronto!",
        content: "Foque no conteúdo. Quando terminar, marque a aula como concluída e abra os exercícios em Ferramentas. Bom estudo!",
      }
    );
    return steps;
  }, [data, lessonId]);

  if (loading || !data) {
    return (
      <div className="flex min-w-0 flex-col gap-8 pb-10 pt-1 sm:gap-10">
          <nav aria-label="Navegação">
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              href={`/minhas-turmas/${enrollmentId}/conteudo`}
            >
              <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
              Voltar ao conteúdo
            </Link>
          </nav>
          <SectionCard title={loading ? "Carregando" : "Aula"} description={loading ? "Buscando dados da aula…" : "Não foi possível localizar esta aula."}>
            <div className="flex flex-col items-center justify-center py-10">
              {loading ? (
                <div className="h-12 w-12 animate-pulse rounded-2xl bg-[var(--igh-primary)]/20" aria-hidden />
              ) : (
                <AlertCircle className="h-12 w-12 text-amber-500/80" aria-hidden />
              )}
              <p className="mt-4 text-center text-sm font-medium text-[var(--text-muted)]">
                {loading ? "Carregando aula…" : "Aula não encontrada."}
              </p>
            </div>
          </SectionCard>
      </div>
    );
  }

  const found = foundForEffect;
  if (!found || !found.lesson.isLiberada) {
    return (
      <div className="flex min-w-0 flex-col gap-8 pb-10 pt-1 sm:gap-10">
          <nav aria-label="Navegação">
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              href={`/minhas-turmas/${enrollmentId}/conteudo`}
            >
              <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
              Voltar ao conteúdo
            </Link>
          </nav>
          <SectionCard
            title={found ? "Aula bloqueada" : "Aula não encontrada"}
            description={found ? "Esta aula ainda não está liberada pelo cronograma ou pela turma." : "Verifique o link ou volte à lista de aulas."}
          >
            <div className="flex flex-col items-center justify-center py-10">
              <AlertCircle className="h-12 w-12 text-amber-500/80" aria-hidden />
              <p className="mt-4 text-center text-sm font-medium text-[var(--text-muted)]">
                {found ? "Esta aula ainda não está liberada." : "Aula não encontrada."}
              </p>
            </div>
          </SectionCard>
      </div>
    );
  }

  const { lesson, moduleTitle } = found;

  const orderedLessonsForAccess = getOrderedLessons(data.modules);
  const currentIndexForAccess = orderedLessonsForAccess.findIndex((l) => l.id === lessonId);
  const prevLessonForAccess =
    currentIndexForAccess > 0 ? orderedLessonsForAccess[currentIndexForAccess - 1] ?? null : null;

  if (currentIndexForAccess > 0 && prevLessonExercisesComplete === null) {
    return (
      <div className="flex min-w-0 flex-col gap-8 pb-10 pt-1 sm:gap-10">
          <nav aria-label="Navegação">
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              href={`/minhas-turmas/${enrollmentId}/conteudo`}
            >
              <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
              Voltar ao conteúdo
            </Link>
          </nav>
          <SectionCard title="Verificando acesso" description="Confirmando se você pode abrir esta aula.">
            <div className="flex flex-col items-center justify-center py-10">
              <div className="h-12 w-12 animate-pulse rounded-2xl bg-[var(--igh-primary)]/20" aria-hidden />
              <p className="mt-4 text-center text-sm font-medium text-[var(--text-muted)]">Verificando acesso…</p>
            </div>
          </SectionCard>
      </div>
    );
  }

  if (currentIndexForAccess > 0 && prevLessonExercisesComplete === false && prevLessonForAccess) {
    return (
      <div className="flex min-w-0 flex-col gap-8 pb-10 pt-1 sm:gap-10">
          <nav aria-label="Navegação">
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              href={`/minhas-turmas/${enrollmentId}/conteudo`}
            >
              <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
              Voltar ao conteúdo
            </Link>
          </nav>
          <SectionCard
            title="Conclua os exercícios da aula anterior"
            description="Para acessar esta aula, é necessário responder a todos os exercícios da aula anterior."
            variant="elevated"
            action={
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <ClipboardList className="h-5 w-5" aria-hidden />
              </div>
            }
          >
            <Link
              href={`/minhas-turmas/${enrollmentId}/conteudo/aula/${prevLessonForAccess.id}?secao=exercicios#ferramentas`}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--igh-primary)] px-5 py-3 text-sm font-bold text-white shadow-md shadow-[var(--igh-primary)]/25 transition hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
            >
              <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
              Ir para exercícios da aula anterior
            </Link>
          </SectionCard>
      </div>
    );
  }

  /** PDF da aula é gerado automaticamente quando há resumo ou conteúdo. */
  const hasPdfToDownload =
    !!(lesson.summary && lesson.summary.trim()) || !!(lesson.contentRich && lesson.contentRich.trim());

  const handleRemovePassage = async (passageId: string) => {
    setRemovingPassageId(passageId);
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/passages/${passageId}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
      if (res.ok && json?.ok) {
        setPassages((prev) => prev.filter((p) => p.id !== passageId));
        toast.push("success", "Trecho removido.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível remover.");
      }
    } finally {
      setRemovingPassageId(null);
    }
  };

  const handleMarkComplete = async () => {
    setMarkingComplete(true);
    try {
      const res = await fetch(`/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
      const json = (await res.json()) as ApiResponse<LessonProgress>;
      if (res.ok && json?.ok) {
        setProgress(json.data);
        toast.push("success", "Aula marcada como concluída.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível atualizar.");
      }
    } finally {
      setMarkingComplete(false);
    }
  };

  const prog: LessonProgress = progress ?? {
    completed: false,
    percentWatched: 0,
    percentRead: 0,
    completedAt: null,
    lastAccessedAt: null,
    totalMinutesStudied: 0,
    lastContentPageIndex: null,
  };

  const orderedLessons = getOrderedLessons(data.modules);
  const currentIndex = orderedLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? orderedLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < orderedLessons.length - 1 ? orderedLessons[currentIndex + 1] : null;
  /** Próxima aula só pode ser aberta quando o cronograma/turma já a liberou (ex.: data da sessão). */
  const nextLessonIsUnlocked = nextLesson?.isLiberada === true;

  const hasExercises = loadedSections.exercicios ? exercises.length > 0 : !currentLessonExercisesComplete;
  const allExercisesAnswered = loadedSections.exercicios
    ? exercises.length === 0 || exercises.every((ex) => exerciseResult[ex.id] != null)
    : currentLessonExercisesComplete;
  const mustAnswerExercisesBeforeNext = hasExercises && !allExercisesAnswered;

  /** Converte "12:34" ou "5" em segundos. Retorna null se vazio ou inválido. */
  function parseVideoMinuteToSeconds(value: string): number | null {
    const s = value.trim();
    if (!s) return null;
    const parts = s.split(":");
    if (parts.length === 1) {
      const m = parseInt(parts[0], 10);
      if (Number.isNaN(m) || m < 0) return null;
      return m * 60;
    }
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const sec = parseInt(parts[1], 10);
      if (Number.isNaN(m) || Number.isNaN(sec) || m < 0 || sec < 0 || sec > 59) return null;
      return m * 60 + sec;
    }
    return null;
  }

  const handleSaveNote = async () => {
    const content = noteContent.trim();
    if (!content) {
      toast.push("error", "Digite a anotação.");
      return;
    }
    const videoTimestampSecs = parseVideoMinuteToSeconds(noteVideoMinute);
    setSavingNote(true);
    try {
      const res = await fetch(`/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          videoTimestampSecs: videoTimestampSecs ?? undefined,
        }),
      });
      const json = (await res.json()) as ApiResponse<LessonNote>;
      if (res.ok && json?.ok) {
        setNotes((prev) => [...prev, json.data]);
        setNoteContent("");
        setNoteVideoMinute("");
        toast.push("success", "Anotação salva.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível salvar.");
      }
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Excluir esta anotação?")) return;
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/notes/${noteId}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
      if (res.ok && json?.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        toast.push("success", "Anotação excluída.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível excluir.");
      }
    } catch {
      toast.push("error", "Não foi possível excluir a anotação.");
    }
  };

  const handleSendQuestion = async () => {
    if (isForumPostEmpty(questionContent, questionImageUrls)) {
      toast.push("error", "Digite uma mensagem ou adicione fotos.");
      return;
    }
    setSavingQuestion(true);
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: questionContent, imageUrls: questionImageUrls }),
        }
      );
      const json = (await res.json()) as ApiResponse<LessonQuestion>;
      if (res.ok && json?.ok) {
        setQuestions((prev) => [...prev, json.data]);
        setQuestionContent("");
        setQuestionImageUrls([]);
        toast.push("success", "Dúvida enviada.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível enviar.");
      }
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Excluir esta dúvida?")) return;
    setRemovingQuestionId(questionId);
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/questions/${questionId}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
      if (res.ok && json?.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
        toast.push("success", "Dúvida excluída.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível excluir.");
      }
    } finally {
      setRemovingQuestionId(null);
    }
  };

  const startEditQuestion = (q: LessonQuestion) => {
    setEditingQuestionId(q.id);
    setEditQuestionContent(q.content);
    setEditQuestionImageUrls(q.imageUrls ?? []);
  };

  const cancelEditQuestion = () => {
    setEditingQuestionId(null);
    setEditQuestionContent("");
    setEditQuestionImageUrls([]);
  };

  const handleSaveEditQuestion = async () => {
    if (!editingQuestionId) return;
    if (isForumPostEmpty(editQuestionContent, editQuestionImageUrls)) {
      toast.push("error", "Digite o conteúdo ou mantenha ao menos uma foto.");
      return;
    }
    setSavingEditQuestionId(editingQuestionId);
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/questions/${editingQuestionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editQuestionContent, imageUrls: editQuestionImageUrls }),
        }
      );
      const json = (await res.json()) as ApiResponse<LessonQuestion>;
      if (res.ok && json?.ok) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === editingQuestionId
              ? {
                  ...q,
                  content: json.data!.content,
                  imageUrls: json.data!.imageUrls ?? [],
                  updatedAt: json.data!.updatedAt,
                }
              : q
          )
        );
        cancelEditQuestion();
        toast.push("success", "Comentário atualizado.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível atualizar.");
      }
    } finally {
      setSavingEditQuestionId(null);
    }
  };

  const startReply = (questionId: string) => {
    setReplyingToQuestionId(questionId);
    setReplyContent("");
  };

  const cancelReply = () => {
    setReplyingToQuestionId(null);
    setReplyContent("");
  };

  const handleSendReply = async (questionId: string) => {
    const content = replyContent.trim();
    if (!content) {
      toast.push("error", "Digite sua resposta.");
      return;
    }
    setSavingReplyQuestionId(questionId);
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/questions/${questionId}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );
      const json = (await res.json()) as ApiResponse<LessonQuestionReply>;
      if (res.ok && json?.ok) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId
              ? { ...q, replies: [...(q.replies ?? []), json.data!] }
              : q
          )
        );
        cancelReply();
        toast.push("success", "Resposta enviada.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível enviar.");
      }
    } finally {
      setSavingReplyQuestionId(null);
    }
  };

  function formatNoteDate(iso: string) {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatStudyDuration(minutes: number): string {
    if (minutes <= 0) return "0 min";
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }

  const handleToggleFavorite = async () => {
    setTogglingFavorite(true);
    try {
      const res = await fetch(`/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/favorite`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: !isFavorite }),
      });
      const json = (await res.json()) as ApiResponse<{ favorite: boolean }>;
      if (res.ok && json?.ok) {
        setIsFavorite(json.data.favorite);
        toast.push("success", json.data.favorite ? "Aula adicionada aos favoritos." : "Aula removida dos favoritos.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível atualizar.");
      }
    } finally {
      setTogglingFavorite(false);
    }
  };

  const handleSubmitExercise = async (exerciseId: string) => {
    const optionId = exerciseSelected[exerciseId];
    if (!optionId) {
      toast.push("error", "Selecione uma opção.");
      return;
    }
    setSubmittingExerciseId(exerciseId);
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/exercises/${exerciseId}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionId }),
        }
      );
      const json = (await res.json()) as ApiResponse<{ correct: boolean; correctOptionId: string | null }>;
      if (res.ok && json?.ok) {
        setExerciseResult((prev) => {
          const next = {
            ...prev,
            [exerciseId]: { correct: json.data!.correct, correctOptionId: json.data!.correctOptionId },
          };
          setCurrentLessonExercisesComplete(
            exercises.length === 0 || exercises.every((ex) => next[ex.id] != null)
          );
          return next;
        });
        toast.push(json.data!.correct ? "success" : "error", json.data!.correct ? "Resposta correta!" : "Resposta incorreta. Veja a correção abaixo.");
      } else {
        const errMsg = json && "error" in json ? (json as { error?: { message?: string } }).error?.message : null;
        toast.push("error", errMsg ?? "Erro ao enviar resposta.");
      }
    } catch {
      toast.push("error", "Erro ao enviar resposta.");
    } finally {
      setSubmittingExerciseId(null);
    }
  };

  /** Envia todas as respostas de uma vez (primeira tentativa). */
  const handleSubmitAllExercises = async () => {
    if (exercises.length === 0) return;
    const missing = exercises.filter((ex) => !exerciseSelected[ex.id]);
    if (missing.length > 0) {
      toast.push("error", "Selecione uma opção em todas as questões antes de verificar.");
      return;
    }
    setSubmittingAllExercises(true);
    let correctCount = 0;
    try {
      for (const ex of exercises) {
        const optionId = exerciseSelected[ex.id]!;
        const res = await fetch(
          `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/exercises/${ex.id}/submit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ optionId }),
          }
        );
        const json = (await res.json()) as ApiResponse<{ correct: boolean; correctOptionId: string | null }>;
        if (res.ok && json?.ok) {
          const correct = json.data!.correct;
          if (correct) correctCount++;
          setExerciseResult((prev) => ({
            ...prev,
            [ex.id]: { correct, correctOptionId: json.data!.correctOptionId },
          }));
        }
      }
      const total = exercises.length;
      setCurrentLessonExercisesComplete(true);
      toast.push(
        "success",
        `Respostas enviadas: ${correctCount} de ${total} acerto${total !== 1 ? "s" : ""}.`
      );
    } catch {
      toast.push("error", "Erro ao enviar respostas. Tente novamente.");
    } finally {
      setSubmittingAllExercises(false);
    }
  };

  /** Primeira vez = nenhuma resposta enviada ainda; mostra só o botão "Verificar todas" no final. */
  const isFirstTimeExercises = exercises.length > 0 && Object.keys(exerciseResult).length === 0;

  const aulaPosicao =
    currentIndex >= 0 && orderedLessons.length > 0
      ? `Aula ${currentIndex + 1} de ${orderedLessons.length}`
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-10 pt-1 sm:gap-5">
      <DashboardTutorial showForStudent={user.role !== "MASTER"} steps={tutorialSteps} storageKey="minhas-turmas-aula-tutorial-done" />
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-secondary)] shadow-md hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          title="Voltar ao topo"
          aria-label="Voltar ao topo"
        >
          <ArrowUp className="h-5 w-5" aria-hidden />
        </button>
      )}

      {/* Header mínimo da sala de aula */}
      <header
        className="flex flex-col gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]/90 px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4"
        data-tour="aula-header"
      >
        <div className="flex min-w-0 items-start gap-2 sm:items-center">
          <Link
            href={`/minhas-turmas/${enrollmentId}/conteudo`}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--igh-primary)] transition hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
            aria-label="Voltar ao conteúdo do curso"
            data-tour="aula-voltar"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[var(--text-muted)]">
              <span className="text-[var(--igh-primary)]">{moduleTitle}</span>
              {aulaPosicao ? <span aria-hidden> · </span> : null}
              {aulaPosicao ? <span>{aulaPosicao}</span> : null}
            </p>
            <h1 className="truncate text-base font-bold tracking-tight text-[var(--text-primary)] sm:text-lg">{lesson.title}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
              prog.completed
                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                : "bg-amber-500/15 text-amber-900 dark:text-amber-200"
            }`}
          >
            {prog.completed ? "Concluída" : "Em andamento"}
          </span>
          {!prog.completed && (
            <button
              type="button"
              onClick={handleMarkComplete}
              disabled={markingComplete}
              aria-busy={markingComplete}
              className="rounded-lg bg-[var(--igh-primary)] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {markingComplete ? "Salvando..." : "Concluir"}
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleFavorite}
            disabled={togglingFavorite}
            aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            aria-pressed={isFavorite}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--text-secondary)] transition hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60"
            title={isFavorite ? "Favorita" : "Favoritar"}
          >
            <span className="text-lg" aria-hidden>{isFavorite ? "★" : "☆"}</span>
          </button>

          <div className="relative" ref={toolsMenuRef} data-tour="aula-ferramentas">
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
                className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1.5 shadow-lg"
              >
                <button type="button" role="menuitem" data-tour="aula-btn-trechos" onClick={() => { openSectionPanel("trechos"); setToolsOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]">
                  <BookMarked className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden /> Trechos destacados
                </button>
                <button type="button" role="menuitem" data-tour="aula-btn-material" onClick={() => { openSectionPanel("material"); setToolsOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]">
                  <FileText className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden /> Material complementar
                </button>
                <button type="button" role="menuitem" data-tour="aula-btn-anotacoes" onClick={() => { openSectionPanel("anotacoes"); setToolsOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]">
                  <StickyNote className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden /> Anotações
                </button>
                <button type="button" role="menuitem" data-tour="aula-btn-exercicios" disabled={!prog?.completed} title={prog?.completed ? undefined : "Conclua a aula para acessar os exercícios"} onClick={() => { if (prog?.completed) { openSectionPanel("exercicios"); setToolsOpen(false); } }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)] disabled:cursor-not-allowed disabled:opacity-50">
                  <ClipboardList className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden /> Exercícios
                </button>
                <button type="button" role="menuitem" data-tour="aula-btn-duvidas" onClick={() => { openSectionPanel("duvidas"); setToolsOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]">
                  <MessageCircleQuestion className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden /> Fórum
                </button>
                <button type="button" role="menuitem" onClick={() => { setProgressDetailsOpen((v) => !v); setOpenSection(null); setToolsOpen(false); setTimeout(() => document.getElementById("ferramentas")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]">
                  <History className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden /> Progresso e histórico
                </button>
                {lesson.summary && lesson.summary.trim() ? (
                  <button type="button" role="menuitem" onClick={() => { setToolsOpen(false); setTimeout(() => { const el = document.getElementById("aula-resumo") as HTMLDetailsElement | null; if (el) el.open = true; el?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden /> Resumo da aula
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
              data-tour="aula-nav-aulas"
            >
              <MoreHorizontal className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Navegar</span>
            </button>
            {courseNavOpen && (
              <div role="menu" className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1.5 shadow-lg">
                {prevLesson ? (
                  <Link role="menuitem" href={`/minhas-turmas/${enrollmentId}/conteudo/aula/${prevLesson.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]" onClick={() => setCourseNavOpen(false)}>
                    <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> Aula anterior
                  </Link>
                ) : (
                  <span className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-muted)]"><ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> Aula anterior</span>
                )}
                {nextLesson ? (
                  mustAnswerExercisesBeforeNext ? (
                    <button type="button" role="menuitem" onClick={() => { setCourseNavOpen(false); toast.push("error", "Responda todos os exercícios desta aula antes de avançar para a próxima."); openSectionPanel("exercicios"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]">
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> Próxima aula
                    </button>
                  ) : !nextLessonIsUnlocked ? (
                    <button type="button" role="menuitem" onClick={() => { setCourseNavOpen(false); toast.push("error", "A próxima aula ainda não está liberada pelo cronograma da turma. Volte em breve ou consulte a lista de aulas."); }} className="flex w-full cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-muted)]">
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> Próxima aula
                    </button>
                  ) : (
                    <Link role="menuitem" href={`/minhas-turmas/${enrollmentId}/conteudo/aula/${nextLesson.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]" onClick={() => setCourseNavOpen(false)}>
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> Próxima aula
                    </Link>
                  )
                ) : (
                  <span className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-muted)]"><ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> Próxima aula</span>
                )}
                <Link role="menuitem" href="/minhas-turmas/favoritos" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]" onClick={() => setCourseNavOpen(false)}>
                  <BookMarked className="h-4 w-4 shrink-0" aria-hidden /> Favoritos
                </Link>
                <Link role="menuitem" href={`/minhas-turmas/${enrollmentId}/conteudo`} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]" onClick={() => setCourseNavOpen(false)}>
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden /> Conteúdo do curso
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Palco: vídeo + conteúdo */}
      <div className="flex flex-col gap-4">
          {lesson.videoUrl && (
            <section className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-black shadow-sm" data-tour="aula-video" aria-label="Vídeo da aula">
              <div className="aspect-video w-full">
                <LessonVideoPlayer videoUrl={lesson.videoUrl} />
              </div>
            </section>
          )}

          {lesson.contentRich && lesson.contentRich.trim() && (
            <div id="conteudo" className="scroll-mt-20" data-tour="aula-conteudo">
              <div
                ref={contentWrapperRef}
                className={
                  isContentFullscreen
                    ? "flex h-[100dvh] flex-col overflow-hidden bg-[var(--card-bg)]"
                    : "flex flex-col overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm"
                }
              >
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 border-b border-[var(--card-border)] px-3 py-2">
                  <div className="flex items-center gap-1" data-tour="aula-fonte">
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
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("highlightable-content-destacar"))}
                    disabled={savingPassage}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60"
                    title={savingPassage ? "Salvando..." : "Destacar trecho selecionado"}
                    aria-label={savingPassage ? "Salvando..." : "Destacar trecho selecionado"}
                    data-tour="aula-destacar-trecho"
                  >
                    <Highlighter className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">{savingPassage ? "Salvando..." : "Destacar"}</span>
                  </button>
                  {!isContentFullscreen && (
                    <button
                      type="button"
                      onClick={() => contentWrapperRef.current?.requestFullscreen()}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                      title="Tela cheia"
                      aria-label="Expandir em tela cheia"
                      data-tour="aula-tela-cheia"
                    >
                      <Maximize2 className="h-4 w-4" aria-hidden />
                      <span className="hidden sm:inline">Tela cheia</span>
                    </button>
                  )}
                </div>

                <div className={`min-h-0 flex-1 overflow-auto px-4 py-4 ${isContentFullscreen ? "sm:px-8" : ""}`} style={{ minHeight: isContentFullscreen ? undefined : "12rem" }}>
                  <div
                    className="origin-top-left"
                    style={{
                      width: `${10000 / contentFontSizePercent}%`,
                      transform: `scale(${contentFontSizePercent / 100})`,
                    }}
                  >
                    <HighlightableContentViewer
                      content={contentToShow}
                      passages={passagesForCurrentPage}
                      onSavePassage={handleSavePassageForPage}
                      saving={savingPassage}
                      hideDestacarButton
                      onWarning={(msg) => toast.push("error", msg)}
                    />
                  </div>
                </div>

                {(hasMultiplePages || isContentFullscreen) && (
                  <nav
                    aria-label="Páginas do conteúdo"
                    data-tour="aula-slides"
                    className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-3"
                    style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
                  >
                    {hasMultiplePages ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const prev = Math.max(0, contentPageIndex - 1);
                            const apiUrl = `/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`;
                            navigator.sendBeacon(apiUrl, new Blob([JSON.stringify({ lastContentPageIndex: prev })], { type: "application/json" }));
                            persistSlideIndex(prev, "clique Slide anterior");
                            router.replace(`/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}?pagina=${prev + 1}#conteudo`);
                            if (!isContentFullscreen) {
                              setTimeout(() => contentWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                            }
                          }}
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
                            onClick={() => {
                              const apiUrl = `/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`;
                              navigator.sendBeacon(apiUrl, new Blob([JSON.stringify({ lastContentPageIndex: 0 })], { type: "application/json" }));
                              persistSlideIndex(0, "clique Primeiro slide");
                              router.replace(`/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}?pagina=1#conteudo`);
                              if (!isContentFullscreen) {
                                setTimeout(() => contentWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                              }
                            }}
                            aria-label="Primeiro slide"
                            className="inline-flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--igh-primary)]/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:flex-none sm:px-4"
                          >
                            <ChevronsLeft className="h-5 w-5 shrink-0" aria-hidden />
                            <span className="hidden sm:inline">Início</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const next = contentPageIndex + 1;
                              const apiUrl = `/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`;
                              navigator.sendBeacon(apiUrl, new Blob([JSON.stringify({ lastContentPageIndex: next })], { type: "application/json" }));
                              persistSlideIndex(next, "clique Próximo slide");
                              router.replace(`/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}?pagina=${next + 1}#conteudo`);
                              if (!isContentFullscreen) {
                                setTimeout(() => contentWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                              }
                            }}
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
                        onClick={() => document.exitFullscreen()}
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--igh-primary)]/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                        title="Sair da tela cheia"
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
          )}

          {!lesson.videoUrl && !(lesson.contentRich && lesson.contentRich.trim()) && lesson.imageUrls.length === 0 && !(lesson.summary && lesson.summary.trim()) && (!lesson.attachmentUrls || lesson.attachmentUrls.length === 0) && (
            <SectionCard title="Conteúdo" description="Esta aula ainda não tem material principal cadastrado.">
              <p className="text-center text-sm text-[var(--text-muted)]">Nenhum conteúdo adicional para esta aula.</p>
            </SectionCard>
          )}

          {/* CTA pós-estudo: próxima aula */}
          {nextLesson && prog.completed && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]/80 px-4 py-3">
              <p className="text-sm text-[var(--text-muted)]">Continue o curso</p>
              {mustAnswerExercisesBeforeNext ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.push("error", "Responda todos os exercícios desta aula antes de avançar para a próxima.");
                    openSectionPanel("exercicios");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--igh-primary)] px-4 py-2.5 text-sm font-bold text-white"
                >
                  Ir aos exercícios <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              ) : nextLessonIsUnlocked ? (
                <Link
                  href={`/minhas-turmas/${enrollmentId}/conteudo/aula/${nextLesson.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--igh-primary)] px-4 py-2.5 text-sm font-bold text-white"
                >
                  Próxima aula <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
            </div>
          )}

          {/* Ferramentas sob demanda */}
          <div id="ferramentas" className="scroll-mt-24" data-tour="aula-secoes">
            {(openSection || progressDetailsOpen) && (
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Ferramentas da aula</p>
                <button
                  type="button"
                  onClick={() => {
                    setOpenSection(null);
                    setProgressDetailsOpen(false);
                    const path = `/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}`;
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete("secao");
                    const qs = params.toString();
                    router.replace(qs ? `${path}?${qs}` : path);
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--igh-surface)] hover:text-[var(--text-primary)]"
                  aria-label="Fechar painel"
                >
                  <X className="h-3.5 w-3.5" aria-hidden /> Fechar
                </button>
              </div>
            )}

            {progressDetailsOpen && (
              <div className="mb-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/95 p-4 shadow-sm sm:p-5" data-tour="aula-progresso">
                <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)]">Progresso e histórico</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${prog.completed ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" : "bg-amber-500/15 text-amber-900 dark:text-amber-200"}`}>
                    {prog.completed ? "Concluída" : "Em andamento"}
                  </span>
                  {!prog.completed && (
                    <button type="button" onClick={handleMarkComplete} disabled={markingComplete} className="rounded-lg bg-[var(--igh-primary)] px-3 py-2 text-sm font-bold text-white disabled:opacity-60">
                      {markingComplete ? "Salvando..." : "Marcar como concluída"}
                    </button>
                  )}
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3" data-tour="aula-historico">
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-3 py-2.5">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Último acesso</dt>
                    <dd className="mt-1 font-semibold text-[var(--text-primary)]">{prog.lastAccessedAt ? formatNoteDate(prog.lastAccessedAt) : "—"}</dd>
                  </div>
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-3 py-2.5">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tempo estudado</dt>
                    <dd className="mt-1 font-semibold text-[var(--text-primary)]">{formatStudyDuration(prog.totalMinutesStudied)}</dd>
                  </div>
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-3 py-2.5">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Conclusão</dt>
                    <dd className="mt-1 font-semibold text-[var(--text-primary)]">{prog.completedAt ? formatNoteDate(prog.completedAt) : "—"}</dd>
                  </div>
                </dl>
              </div>
            )}

          {openSection && (
            <div ref={sectionPanelRef} className="scroll-mt-24 mt-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/95 p-4 shadow-sm backdrop-blur-sm sm:p-5">
              {openSection === "trechos" && (
                <div>
                  <h2 className="mb-2 text-base font-semibold text-[var(--text-primary)]">Trechos destacados</h2>
                  {loadedSections.trechos ? (
                    passages.length > 0 ? (
                      <ul className="space-y-2">
                        {passages.map((p) => (
                          <li
                            key={p.id}
                            className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                          >
                            <span className="min-w-0 flex-1 text-[var(--text-primary)]">&ldquo;{p.text}&rdquo;</span>
                            <button
                              type="button"
                              onClick={() => handleRemovePassage(p.id)}
                              disabled={removingPassageId === p.id}
                              className="shrink-0 text-xs text-[var(--igh-primary)] underline hover:no-underline disabled:opacity-60"
                            >
                              {removingPassageId === p.id ? "Removendo..." : "Remover"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--text-muted)]">
                        Nenhum trecho destacado ainda. Selecione um texto no conteúdo acima e use o botão &ldquo;Destacar trecho selecionado&rdquo; para adicionar.
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
                  )}
                </div>
              )}

              {openSection === "material" && (
                <div>
                  <h2 id="material-heading" className="mb-1 text-base font-semibold text-[var(--text-primary)]">Material complementar</h2>
                  <p className="mb-4 text-xs text-[var(--text-muted)]">Baixe o PDF da aula e os arquivos de apoio para estudar offline.</p>
                  <ul className="flex flex-col gap-2">
                    {hasPdfToDownload && (
                      <li>
                        <PdfDownloadButton
                          enrollmentId={enrollmentId}
                          lessonId={lessonId}
                          lessonTitle={lesson.title}
                        />
                      </li>
                    )}
                    {lesson.attachmentUrls?.map((url, i) => {
                      const label = getAttachmentLabel(url, i, lesson.attachmentNames?.[i]);
                      return (
                        <li key={i}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={label}
                            className="inline-flex max-w-fit items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-medium text-[var(--igh-primary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                          >
                            <span aria-hidden>📎</span>
                            {label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {openSection === "anotacoes" && (
                <div>
                  <h2 id="anotacoes-heading" className="mb-1 text-base font-semibold text-[var(--text-primary)]">Bloco de anotações</h2>
                  <p className="mb-4 text-xs text-[var(--text-muted)]">Suas anotações ficam salvas por aula. Opcionalmente, informe o minuto do vídeo (ex.: 12:34 ou 5).</p>
                  <div className="mb-4 flex flex-col gap-3">
                    <label htmlFor="note-content" className="sr-only">Texto da anotação</label>
                    <textarea
                      id="note-content"
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Digite sua anotação..."
                      rows={3}
                      className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--igh-primary)]"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="note-minute" className="text-xs text-[var(--text-muted)]">Minuto do vídeo (opcional):</label>
                      <input
                        id="note-minute"
                        type="text"
                        value={noteVideoMinute}
                        onChange={(e) => setNoteVideoMinute(e.target.value)}
                        placeholder="ex: 12:34 ou 5"
                        className="w-24 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--igh-primary)]"
                      />
                      <button
                        type="button"
                        onClick={handleSaveNote}
                        disabled={savingNote || !noteContent.trim()}
                        aria-busy={savingNote}
                        className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60"
                      >
                        {savingNote ? "Salvando..." : "Salvar anotação"}
                      </button>
                    </div>
                  </div>
                  {loadedSections.anotacoes ? (
                    notes.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                        Nenhuma anotação ainda. Use o campo acima para registrar suas ideias durante a aula.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {notes.map((note) => (
                          <li key={note.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-sm">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-baseline gap-2 text-xs text-[var(--text-muted)]">
                                <span>{formatNoteDate(note.createdAt)}</span>
                                {note.videoTimestampLabel != null && (
                                  <span className="font-medium text-[var(--igh-secondary)]">· Vídeo {note.videoTimestampLabel}</span>
                                )}
                              </div>
                              <p className="whitespace-pre-wrap text-[var(--text-primary)]">{note.content}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(note.id)}
                              className="shrink-0 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                              title="Excluir anotação"
                            >
                              Excluir
                            </button>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
                  )}
                </div>
              )}

              {openSection === "exercicios" && prog?.completed && (
                <div>
                  <h2 className="mb-1 text-base font-semibold text-[var(--text-primary)]">Exercícios</h2>
                  {loadedSections.exercicios ? (
                    exercises.length > 0 ? (
                      <>
                        <p className="mb-4 text-xs text-[var(--text-muted)]">
                          {isFirstTimeExercises
                            ? "Selecione uma opção em cada questão e clique no botão ao final para verificar todas as respostas de uma vez."
                            : "Responda às questões e clique em Verificar para conferir. Você pode refazer quantas vezes quiser; o histórico das tentativas é mantido."}
                        </p>
                        {Object.keys(exerciseResult).length > 0 && (
                          <div className="mb-4 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3" role="status" aria-live="polite">
                            <p className="text-sm font-medium text-[var(--text-primary)]">
                              Seu desempenho nesta aula (última tentativa):{" "}
                              <span className="text-[var(--igh-primary)]">
                                {Object.values(exerciseResult).filter((r) => r.correct).length} de {Object.keys(exerciseResult).length} acertos
                              </span>
                              {Object.keys(exerciseResult).length > 0 && (
                                <span className="ml-1 text-[var(--text-muted)]">
                                  ({Math.round((Object.values(exerciseResult).filter((r) => r.correct).length / Object.keys(exerciseResult).length) * 100)}%)
                                </span>
                              )}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">Abaixo você vê cada questão com a indicação de acerto ou erro. Use &ldquo;Refazer&rdquo; para tentar de novo; o histórico é mantido.</p>
                          </div>
                        )}
                        {Object.keys(exerciseResult).length === exercises.length && exercises.length > 0 && (
                          <div className="mb-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setExerciseResult({});
                                setExerciseSelected({});
                                setCurrentLessonExercisesComplete(false);
                              }}
                              className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-medium text-[var(--igh-primary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                            >
                              Refazer todos os exercícios
                            </button>
                          </div>
                        )}
                        {exercises.map((ex, idx) => {
                          const result = exerciseResult[ex.id];
                          const correctOptionText = result?.correctOptionId ? ex.options.find((o) => o.id === result.correctOptionId)?.text : null;
                          return (
                            <div key={ex.id} className="mb-6 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                              <p className="mb-3 font-medium text-[var(--text-primary)]">{idx + 1}. {ex.question}</p>
                              <ul className="list-none space-y-2">
                                {ex.options.map((opt) => {
                                  const isSelected = exerciseSelected[ex.id] === opt.id;
                                  const showGreen = result?.correct && isSelected;
                                  const showRed = result && !result.correct && isSelected;
                                  return (
                                  <li key={opt.id} className="list-none">
                                    <label
                                      className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${
                                        showGreen
                                          ? "border-green-500 bg-green-50 dark:border-green-500 dark:bg-green-950/30"
                                          : showRed
                                            ? "border-red-400 bg-red-50 dark:border-red-500 dark:bg-red-950/30"
                                            : "border-[var(--card-border)] bg-[var(--igh-surface)] has-[:checked]:border-[var(--igh-primary)] has-[:checked]:bg-[var(--igh-primary)]/10"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name={`ex-${ex.id}`}
                                        checked={isSelected}
                                        onChange={() => setExerciseSelected((s) => ({ ...s, [ex.id]: opt.id }))}
                                        disabled={!!result}
                                        className="h-4 w-4"
                                      />
                                      <span>{opt.text}</span>
                                    </label>
                                  </li>
                                  );
                                })}
                              </ul>
                              {result ? (
                                <div className="mt-3 flex flex-col gap-2">
                                  <div className="flex flex-wrap items-center gap-3">
                                    <p className={`text-sm font-medium ${result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                      {result.correct ? "✓ Correto!" : "✗ Incorreto."}
                                    </p>
                                    {!result.correct && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setExerciseResult((prev) => {
                                            const next = { ...prev };
                                            delete next[ex.id];
                                            return next;
                                          });
                                          setExerciseSelected((prev) => {
                                            const next = { ...prev };
                                            delete next[ex.id];
                                            return next;
                                          });
                                        }}
                                        className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-medium text-[var(--igh-primary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                                      >
                                        Refazer
                                      </button>
                                    )}
                                  </div>
                                  {ex.answerJustification?.trim() ? (
                                    <div className="rounded-lg border border-[var(--igh-primary)]/25 bg-[var(--igh-primary)]/5 px-3 py-2.5 text-sm text-[var(--text-secondary)]">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--igh-primary)]">
                                        Justificativa
                                      </p>
                                      <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                                        {ex.answerJustification.trim()}
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              ) : isFirstTimeExercises ? (
                                <p className="mt-2 text-xs text-[var(--text-muted)]">Use o botão ao final para verificar todas as respostas.</p>
                              ) : (
                                <div className="mt-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSubmitExercise(ex.id)}
                                    disabled={submittingExerciseId === ex.id || !exerciseSelected[ex.id]}
                                    className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                                  >
                                    {submittingExerciseId === ex.id ? "Verificando..." : "Verificar"}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {isFirstTimeExercises && (
                          <div className="mt-6 flex justify-center border-t border-[var(--card-border)] pt-6">
                            <button
                              type="button"
                              onClick={handleSubmitAllExercises}
                              disabled={submittingAllExercises || exercises.some((ex) => !exerciseSelected[ex.id])}
                              className="rounded-lg bg-[var(--igh-primary)] px-6 py-3 text-base font-medium text-white hover:opacity-90 disabled:opacity-60"
                            >
                              {submittingAllExercises ? "Verificando todas..." : "Verificar todas as respostas"}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-[var(--text-muted)]">Não há exercícios para esta aula.</p>
                    )
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
                  )}
                </div>
              )}

              {openSection === "duvidas" && (
                <div>
                  <h2 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">Fórum desta aula</h2>
                  <p className="mb-3 text-xs text-[var(--text-muted)]">
                    Envie sua dúvida ou comente sobre a aula. Use formatação de texto (opcional) e anexe até 10 fotos por
                    publicação. Você pode editar seus próprios comentários. Qualquer aluno pode responder.
                  </p>
                  <div className="mb-4">
                    <ForumPostComposer
                      content={questionContent}
                      onContentChange={setQuestionContent}
                      imageUrls={questionImageUrls}
                      onImageUrlsChange={setQuestionImageUrls}
                      onSubmit={() => void handleSendQuestion()}
                      submitting={savingQuestion}
                      submitLabel="Enviar dúvida"
                      placeholder="Enviar dúvida sobre esta aula…"
                    />
                  </div>
                  {loadedSections.duvidas ? (
                    questions.length === 0 ? (
                      <p className="text-sm text-[var(--text-muted)]">Nenhuma dúvida ou comentário ainda. Seja o primeiro a enviar.</p>
                    ) : (
                      <ul className="space-y-3">
                        {questions.map((q) => (
                          <li key={q.id} className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-sm">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex flex-wrap items-baseline gap-2 text-xs text-[var(--text-muted)]">
                                  <span className="font-medium text-[var(--text-secondary)]">{q.authorName}</span>
                                  <span>{formatNoteDate(q.createdAt)}</span>
                                  {q.updatedAt && q.updatedAt !== q.createdAt && <span className="italic">(editado)</span>}
                                </div>
                                {editingQuestionId === q.id ? (
                                  <div className="space-y-2">
                                    <ForumPostComposer
                                      content={editQuestionContent}
                                      onContentChange={setEditQuestionContent}
                                      imageUrls={editQuestionImageUrls}
                                      onImageUrlsChange={setEditQuestionImageUrls}
                                      onSubmit={() => void handleSaveEditQuestion()}
                                      submitting={savingEditQuestionId === q.id}
                                      submitLabel="Salvar"
                                      placeholder="Editar comentário…"
                                      minEditorHeight="120px"
                                    />
                                    <button
                                      type="button"
                                      onClick={cancelEditQuestion}
                                      disabled={savingEditQuestionId === q.id}
                                      className="rounded border border-[var(--card-border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] disabled:opacity-60"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  <ForumPostBody
                                    content={q.content}
                                    imageUrls={q.imageUrls}
                                    altPrefix={`Foto de ${q.authorName}`}
                                  />
                                )}
                              </div>
                              {editingQuestionId !== q.id && q.enrollmentId === enrollmentId && (
                                <div className="flex shrink-0 gap-1">
                                  <button type="button" onClick={() => startEditQuestion(q)} className="rounded px-2 py-1 text-xs font-medium text-[var(--igh-primary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2" title="Editar comentário">Editar</button>
                                  <button type="button" onClick={() => handleDeleteQuestion(q.id)} disabled={removingQuestionId === q.id} className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-60" title="Excluir dúvida">
                                    {removingQuestionId === q.id ? "Excluindo..." : "Excluir"}
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="mt-3 border-t border-[var(--card-border)] pt-3 pl-3">
                              {(q.teacherReplies ?? []).length > 0 && (
                                <div className="mb-3 rounded-md border border-[var(--igh-primary)]/30 bg-[var(--igh-primary)]/5 p-2">
                                  <p className="mb-2 text-xs font-semibold text-[var(--igh-primary)]">Resposta do professor</p>
                                  {(q.teacherReplies ?? []).map((r) => (
                                    <div key={r.id} className="mb-2 text-xs last:mb-0">
                                      <div className="flex flex-wrap items-baseline gap-2">
                                        <span className="font-medium text-[var(--text-primary)]">{r.teacherName}</span>
                                        <span className="text-[var(--text-muted)]">{formatNoteDate(r.createdAt)}</span>
                                      </div>
                                      <p className="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">{r.content}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {(q.replies ?? []).length > 0 && (
                                <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">Respostas de alunos ({(q.replies ?? []).length})</p>
                              )}
                              {(q.replies ?? []).map((r) => (
                                <div key={r.id} className="mb-2 flex flex-wrap items-baseline gap-2 text-xs">
                                  <span className="font-medium text-[var(--text-secondary)]">{r.authorName}</span>
                                  <span className="text-[var(--text-muted)]">{formatNoteDate(r.createdAt)}</span>
                                  <p className="w-full whitespace-pre-wrap text-[var(--text-primary)]">{r.content}</p>
                                </div>
                              ))}
                              {replyingToQuestionId === q.id ? (
                                <div className="space-y-2">
                                  <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} rows={2} className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--igh-primary)]" placeholder="Escreva sua resposta..." />
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => handleSendReply(q.id)} disabled={savingReplyQuestionId === q.id || !replyContent.trim()} className="rounded bg-[var(--igh-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60">
                                      {savingReplyQuestionId === q.id ? "Enviando..." : "Enviar resposta"}
                                    </button>
                                    <button type="button" onClick={cancelReply} disabled={savingReplyQuestionId === q.id} className="rounded border border-[var(--card-border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] disabled:opacity-60">
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button type="button" onClick={() => startReply(q.id)} className="rounded text-xs font-medium text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2" title="Responder ao comentário">
                                  Responder ao comentário
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
                  )}
                </div>
              )}
            </div>
          )}


            {lesson.summary && lesson.summary.trim() && (
              <details id="aula-resumo" className="scroll-mt-24 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]/80 px-4 py-3" data-tour="aula-resumo">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--text-secondary)]">Resumo da aula</summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {lesson.summary
                    .trim()
                    .split(/\n/)
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line, i) => (
                      <li key={i}>{line.replace(/^[•\-*]\s*/, "")}</li>
                    ))}
                </ul>
              </details>
            )}
          </div>
      </div>
    </div>
  );
}

