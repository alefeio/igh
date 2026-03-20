"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  BookMarked,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronUp,
  ClipboardList,
  FileText,
  GraduationCap,
  Highlighter,
  ListVideo,
  Maximize2,
  MessageCircleQuestion,
  Minimize2,
  Minus,
  Plus,
  StickyNote,
  Type,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { DashboardTutorial, type TutorialStep } from "@/components/dashboard/DashboardTutorial";
import { DashboardHero, QuickActionGrid, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { HighlightableContentViewer, type LessonPassage } from "@/components/lesson/HighlightableContentViewer";
import { LessonVideoPlayer } from "@/components/lesson/LessonVideoPlayer";
import type { ApiResponse } from "@/lib/api-types";

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
  type LessonExercise = { id: string; order: number; question: string; options: ExerciseOption[] };
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
    createdAt: string;
    updatedAt?: string;
    enrollmentId: string;
    authorName: string;
    replies?: LessonQuestionReply[];
    teacherReplies?: LessonTeacherReply[];
  };
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [questionContent, setQuestionContent] = useState("");
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [removingQuestionId, setRemovingQuestionId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionContent, setEditQuestionContent] = useState("");
  const [savingEditQuestionId, setSavingEditQuestionId] = useState<string | null>(null);
  const [replyingToQuestionId, setReplyingToQuestionId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [savingReplyQuestionId, setSavingReplyQuestionId] = useState<string | null>(null);
  const headerActionsRef = useRef<HTMLDivElement>(null);
  /** Ref da seção "Seções da aula" (botões): quando ela some no scroll, mostramos a barra flutuante. */
  const sectionsBarRef = useRef<HTMLDivElement>(null);
  const [showFloatingActions, setShowFloatingActions] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
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
  /** Menu do painel: true = recolhido (só ícones). No PC expandido por padrão; no mobile (≤767px) minimizado. */
  const [panelMenuCollapsed, setPanelMenuCollapsed] = useState(false);
  const sectionPanelRef = useRef<HTMLDivElement>(null);
  /** Índice inicial quando a URL ainda não tem ?pagina= (antes de restaurar do progresso). */
  const [initialSlideIndex, setInitialSlideIndex] = useState(0);
  const contentPageIndexRef = useRef(0);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const [isContentFullscreen, setIsContentFullscreen] = useState(false);
  const [contentFontSizePercent, setContentFontSizePercent] = useState(100);
  const hasSetUrlFromProgressRef = useRef(false);
  const hasAutoCompletedOnLastSlideRef = useRef(false);
  /** Se a aula atual pode ser acessada (exercícios da aula anterior concluídos). null = ainda verificando. */
  const [prevLessonExercisesComplete, setPrevLessonExercisesComplete] = useState<boolean | null>(null);

  /** Abre/fecha a seção e atualiza a URL (?secao= e #secoes) para abrir na âncora Seções da aula. */
  const openSectionPanel = useCallback(
    (key: SectionKey) => {
      const willClose = openSection === key;
      const next: SectionKey | null = willClose ? null : key;
      setOpenSection(next);
      if (!willClose) setPanelMenuCollapsed(false);
      const path = `/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}`;
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("secao", next);
      else params.delete("secao");
      const qs = params.toString();
      const hash = next ? "#secoes" : "";
      router.replace(qs ? `${path}?${qs}${hash}` : `${path}${hash}`);
      if (next) {
        setTimeout(() => {
          document.getElementById("secoes")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    },
    [enrollmentId, lessonId, openSection, router, searchParams]
  );

  /** Viewport: mobile = menu de seções minimizado; desktop (≥ Tailwind md) = expandido. */
  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setPanelMenuCollapsed(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /** Ao carregar ou quando a URL mudar, abre a seção indicada por ?secao= */
  useEffect(() => {
    const secao = searchParams.get("secao");
    const valid = SECTION_KEYS.includes(secao as SectionKey) ? (secao as SectionKey) : null;
    if (valid) {
      setOpenSection(valid);
      setPanelMenuCollapsed(false);
    } else if (secao !== null) {
      setOpenSection(null);
    }
  }, [searchParams]);

  /** Ao abrir uma seção, rola até a âncora "Seções da aula" (com delay para não ser sobrescrito pelo scroll do Next.js). */
  useEffect(() => {
    if (openSection) {
      const t = setTimeout(() => {
        document.getElementById("secoes")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      return () => clearTimeout(t);
    }
  }, [openSection]);

  const loadProgress = useCallback(async () => {
    if (!enrollmentId || !lessonId) return;
    try {
      const res = await fetch(`/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`);
      const json = (await res.json()) as ApiResponse<LessonProgress>;
      if (res.ok && json?.ok) setProgress(json.data);
    } catch {
      setProgress({
        completed: false,
        percentWatched: 0,
        percentRead: 0,
        completedAt: null,
        lastAccessedAt: null,
        totalMinutesStudied: 0,
        lastContentPageIndex: null,
      });
    }
  }, [enrollmentId, lessonId]);

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
  }, [lessonId]);

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsContentFullscreen(!!document.fullscreenElement && document.fullscreenElement === contentWrapperRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    console.log("Página da aula montada. Abra o DevTools (F12) > aba Console e role a página para ver 'SCROLL ATIVADO'.");
    return () => console.log("Página da aula desmontada.");
  }, []);

  useEffect(() => {
    if (!enrollmentId || !lessonId) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/me/enrollments/${enrollmentId}/course-content`);
        const json = (await res.json()) as ApiResponse<{ courseName: string; modules: Module[] }>;
        if (res.ok && json?.ok) setData(json.data);
        else toast.push("error", json && "error" in json ? json.error.message : "Conteúdo não disponível.");
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

  const loadFavorite = useCallback(async () => {
    if (!enrollmentId || !lessonId) return;
    try {
      const res = await fetch(`/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/favorite`);
      const json = (await res.json()) as ApiResponse<{ favorite: boolean }>;
      if (res.ok && json?.ok) setIsFavorite(json.data.favorite);
    } catch {
      setIsFavorite(false);
    }
  }, [enrollmentId, lessonId]);

  const loadExercises = useCallback(async () => {
    if (!enrollmentId || !lessonId) return;
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/exercises`
      );
      const json = (await res.json()) as ApiResponse<{
        exercises: { id: string; order: number; question: string; options: { id: string; text: string; order: number }[] }[];
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
      } else {
        setExercises([]);
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

  useEffect(() => {
    if (enrollmentId && lessonId) void loadProgress();
  }, [enrollmentId, lessonId, loadProgress]);

  // Carrega exercícios em segundo plano para saber se é permitido avançar para a próxima aula.
  useEffect(() => {
    if (enrollmentId && lessonId) void loadExercises();
  }, [enrollmentId, lessonId, loadExercises]);

  // Verifica se os exercícios da aula anterior foram concluídos (bloqueia acesso à aula atual se não).
  useEffect(() => {
    if (!enrollmentId || !data?.modules || !lessonId) return;
    const ordered = getOrderedLessons(data.modules);
    const idx = ordered.findIndex((l) => l.id === lessonId);
    if (idx <= 0) {
      setPrevLessonExercisesComplete(true);
      return;
    }
    setPrevLessonExercisesComplete(null);
    const prevId = ordered[idx - 1]!.id;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/me/enrollments/${enrollmentId}/lessons/${prevId}/exercises`
        );
        const json = (await res.json()) as ApiResponse<{
          exercises: { id: string }[];
          answers: { exerciseId: string }[];
        }>;
        if (cancelled) return;
        const exercises = (json?.ok ? json.data?.exercises : undefined) ?? [];
        const answers = (json?.ok ? json.data?.answers : undefined) ?? [];
        const allAnswered =
          exercises.length === 0 ||
          exercises.every((ex) => answers.some((a) => a.exerciseId === ex.id));
        setPrevLessonExercisesComplete(res.ok && json?.ok ? allAnswered : true);
      } catch {
        if (!cancelled) setPrevLessonExercisesComplete(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enrollmentId, data?.modules, lessonId]);

  useEffect(() => {
    if (data && findLesson(data.modules, lessonId)?.lesson.isLiberada) {
      void loadProgress();
      void loadFavorite();
    }
  }, [data, lessonId, loadProgress, loadFavorite]);

  /** Marca último acesso ao abrir a aula e envia tempo de estudo ao sair. */
  useEffect(() => {
    if (!enrollmentId || !lessonId || !data?.modules) return;
    const lesson = findLesson(data.modules, lessonId)?.lesson;
    if (!lesson?.isLiberada) return;

    const startMs = Date.now();

    const touchProgress = async () => {
      try {
        const res = await fetch(`/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            percentWatched: progress?.percentWatched ?? 0,
            percentRead: progress?.percentRead ?? 0,
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as ApiResponse<LessonProgress>;
          if (json?.ok) setProgress(json.data);
        }
      } catch {
        // ignore
      }
    };

    void touchProgress().then(() => { loadProgress(); });

    const sendStudyTime = (minutes: number) => {
      if (minutes <= 0) return;
      const body = JSON.stringify({
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
        fetch(`/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            percentWatched: progress?.percentWatched ?? 0,
            percentRead: progress?.percentRead ?? 0,
            studyMinutesDelta: minutes,
            lastContentPageIndex: contentPageIndexRef.current,
          }),
          keepalive: true,
        }).then(async (res) => {
          const json = (await res.json()) as ApiResponse<LessonProgress>;
          if (res.ok && json?.ok) setProgress(json.data);
        }).catch(() => {});
      }
    };
  }, [enrollmentId, lessonId, data?.modules]);

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

  /** Persiste o índice do slide no backend (reutilizado nos botões e ao sair/ocultar). */
  const persistSlideIndex = useCallback(
    (index: number, from: string) => {
      if (!enrollmentId || !lessonId || progress?.completed) return;
      console.log("[Slide] Salvando no banco:", { momento: from, indice: index, paginaExibida: index + 1 });
      const url = `/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`;
      fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastContentPageIndex: index }),
      })
        .then(async (res) => {
          const json = (await res.json()) as ApiResponse<LessonProgress>;
          if (res.ok && json?.ok && json.data) {
            console.log("[Slide] Banco atualizado com sucesso (indice", index, ")");
            setProgress(json.data);
          } else {
            console.warn("[Slide] Resposta do banco não OK:", res.status, json);
          }
        })
        .catch((err) => {
          console.error("[Slide] Erro ao salvar no banco:", err);
        });
    },
    [enrollmentId, lessonId, progress?.completed]
  );

  const gotoPrevSlide = useCallback(() => {
    if (!hasMultiplePages) return;
    const cur = contentPageIndexRef.current;
    if (cur <= 0) return;
    const prev = Math.max(0, cur - 1);
    const apiUrl = `/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`;
    const body = JSON.stringify({ lastContentPageIndex: prev });
    navigator.sendBeacon(apiUrl, new Blob([body], { type: "application/json" }));
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
    const apiUrl = `/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`;
    const body = JSON.stringify({ lastContentPageIndex: next });
    navigator.sendBeacon(apiUrl, new Blob([body], { type: "application/json" }));
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
        console.log("[Slide] Aba oculta, persistindo índice", contentPageIndexRef.current);
        persistSlideIndex(contentPageIndexRef.current, "visibilitychange (aba oculta)");
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
    fetch(url, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true, lastContentPageIndex: contentPageIndex }),
    })
      .then(async (res) => {
        const json = (await res.json()) as ApiResponse<LessonProgress>;
        if (res.ok && json?.ok && json.data) {
          setProgress(json.data);
          toast.push("success", "Aula marcada como concluída.");
        } else {
          hasAutoCompletedOnLastSlideRef.current = false;
          if (res.status === 401) {
            toast.push("error", "Sessão expirada. Faça login novamente.");
          } else {
            toast.push("error", "Não foi possível atualizar o status da aula.");
          }
        }
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

  // Barra flutuante "Seções da aula": quando a seção #secoes sai do topo da tela, mostra a barra fixa embaixo.
  useEffect(() => {
    if (!showLessonCard) return;
    const updateVisibility = () => {
      const el = document.getElementById("secoes");
      if (el) {
        const rect = el.getBoundingClientRect();
        // Mostrar barra quando a seção já passou do topo (pequena margem para evitar flicker)
        setShowFloatingActions(rect.bottom < 8);
      }
    };
    // Rodar após o paint para garantir que #secoes já está no DOM
    const raf = requestAnimationFrame(updateVisibility);
    window.addEventListener("scroll", updateVisibility, { passive: true });
    const t = setTimeout(updateVisibility, 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("scroll", updateVisibility);
    };
  }, [showLessonCard, lessonId]);

  useEffect(() => {
    if (!showLessonCard) return;
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showLessonCard, lessonId]);

  // Debug: logar sempre que o scroll for ativado (window ou document)
  useEffect(() => {
    if (!showLessonCard) return;
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
    console.log("SCROLL DEBUG: listener instalado em window e document (página da aula visível). Role a página para ver 'SCROLL ATIVADO'.");
    window.addEventListener("scroll", onScrollDebug, { passive: true });
    document.addEventListener("scroll", onScrollDebug, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScrollDebug);
      document.removeEventListener("scroll", onScrollDebug);
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
        target: "[data-tour=\"aula-voltar\"]",
        title: "Voltar ao conteúdo",
        content: "Use este link para retornar à lista de módulos e aulas do curso.",
      },
      {
        target: "[data-tour=\"aula-nav-aulas\"]",
        title: "Navegação entre aulas",
        content: "Aqui você pode ir para a aula anterior, para os favoritos ou para a próxima aula.",
      },
      {
        target: "[data-tour=\"aula-header\"]",
        title: "Título da aula",
        content: "Este é o nome da aula. Você pode marcar como favorita pelo botão ao lado.",
      },
      {
        target: "[data-tour=\"aula-progresso\"]",
        title: "Progresso da aula",
        content: "Você pode marcar a aula como concluída manualmente ou ela será concluída automaticamente ao terminar o conteúdo (vídeo e/ou todas as páginas). Os exercícios ficam disponíveis só depois de concluir a aula.",
      },
      {
        target: "[data-tour=\"aula-historico\"]",
        title: "Histórico de estudo",
        content: "Aqui aparecem a última vez que você acessou, quanto tempo estudou e quando concluiu a aula.",
      },
      {
        target: "[data-tour=\"aula-btn-trechos\"]",
        title: "Trechos destacados",
        content: "Abra esta seção para ver os trechos que você destacou no texto. Para destacar: selecione um trecho no conteúdo e use o botão \"Destacar trecho selecionado\".",
      },
      {
        target: "[data-tour=\"aula-btn-material\"]",
        title: "Material complementar",
        content: "Aqui você baixa o PDF da aula e os arquivos de apoio para estudar offline.",
      },
      {
        target: "[data-tour=\"aula-btn-anotacoes\"]",
        title: "Bloco de anotações",
        content: "Suas anotações ficam salvas por aula. Você pode informar o minuto do vídeo (opcional) para localizar depois.",
      },
      {
        target: "[data-tour=\"aula-btn-exercicios\"]",
        title: "Exercícios",
        content: "Após concluir a aula, os exercícios ficam disponíveis aqui. Responda às questões e verifique suas respostas.",
      },
      {
        target: "[data-tour=\"aula-btn-duvidas\"]",
        title: "Dúvidas",
        content: "Envie dúvidas ou comentários sobre a aula. Outros alunos podem responder. Você pode editar ou excluir seus próprios comentários.",
      },
    ];
    if (lesson.summary && lesson.summary.trim()) {
      steps.push({
        target: "[data-tour=\"aula-resumo\"]",
        title: "Resumo rápido",
        content: "Visão geral do que você vai aprender nesta aula.",
      });
    }
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
        title: "Conteúdo escrito da aula",
        content: "Leia o texto da aula. Abaixo há botões para alterar o tamanho da fonte, destacar trechos e expandir em tela cheia.",
      });
      if (hasMultiplePages) {
        steps.push({
          target: "[data-tour=\"aula-slides\"]",
          title: "Slide anterior e Próximo slide",
          content: "Quando o conteúdo tem várias seções, use estes botões para navegar entre as páginas. O progresso é salvo automaticamente e a aula pode ser marcada como concluída ao chegar ao último slide.",
        });
      }
      steps.push(
        {
          target: "[data-tour=\"aula-fonte\"]",
          title: "Tamanho da fonte",
          content: "Use estes botões para diminuir ou aumentar o tamanho do texto do conteúdo.",
        },
        {
          target: "[data-tour=\"aula-destacar-trecho\"]",
          title: "Destacar trecho selecionado",
          content: "Selecione um trecho do texto e clique neste botão para salvá-lo em \"Trechos destacados\" e revisar depois.",
        },
        {
          target: "[data-tour=\"aula-tela-cheia\"]",
          title: "Tela cheia",
          content: "Expanda o conteúdo em tela cheia para leitura mais confortável. Use o mesmo botão ou ESC para sair.",
        }
      );
    }
    steps.push(
      {
        target: null,
        title: "Barra de atalhos",
        content: "Ao rolar a página, aparece uma barra na parte inferior com atalhos para destacar trechos, favoritar e abrir as seções. O botão de voltar ao topo fica no canto direito.",
      },
      {
        target: null,
        title: "Tudo pronto!",
        content: "Assista ao vídeo, leia o conteúdo e faça anotações. Ao concluir a aula, responda aos exercícios. Envie dúvidas na seção Dúvidas. Bom estudo!",
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
              href={`/minhas-turmas/${enrollmentId}/conteudo/aula/${prevLessonForAccess.id}?secao=exercicios#secoes`}
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

  const hasExercises = exercises.length > 0;
  const allExercisesAnswered =
    hasExercises && exercises.every((ex) => exerciseResult[ex.id] != null);
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
    const content = questionContent.trim();
    if (!content) {
      toast.push("error", "Digite sua dúvida.");
      return;
    }
    setSavingQuestion(true);
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );
      const json = (await res.json()) as ApiResponse<LessonQuestion>;
      if (res.ok && json?.ok) {
        setQuestions((prev) => [...prev, json.data]);
        setQuestionContent("");
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
  };

  const cancelEditQuestion = () => {
    setEditingQuestionId(null);
    setEditQuestionContent("");
  };

  const handleSaveEditQuestion = async () => {
    if (!editingQuestionId) return;
    const content = editQuestionContent.trim();
    if (!content) {
      toast.push("error", "Digite o conteúdo.");
      return;
    }
    setSavingEditQuestionId(editingQuestionId);
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/questions/${editingQuestionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );
      const json = (await res.json()) as ApiResponse<LessonQuestion>;
      if (res.ok && json?.ok) {
        setQuestions((prev) =>
          prev.map((q) => (q.id === editingQuestionId ? { ...q, content: json.data!.content, updatedAt: json.data!.updatedAt } : q))
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
        setExerciseResult((prev) => ({
          ...prev,
          [exerciseId]: { correct: json.data!.correct, correctOptionId: json.data!.correctOptionId },
        }));
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
    <div className="flex min-w-0 flex-col gap-8 pb-10 pt-1 sm:gap-10">
      <DashboardTutorial showForStudent={user.role !== "MASTER"} steps={tutorialSteps} storageKey="minhas-turmas-aula-tutorial-done" />
      {showFloatingActions && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-wrap items-center justify-center gap-2 border-t border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {lesson.contentRich && lesson.contentRich.trim() && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("highlightable-content-destacar"))}
              disabled={savingPassage}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60"
              title={savingPassage ? "Salvando..." : "Destacar trecho selecionado"}
              aria-label={savingPassage ? "Salvando..." : "Destacar trecho selecionado"}
            >
              <Highlighter className="h-5 w-5" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleFavorite}
            disabled={togglingFavorite}
            aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            aria-pressed={isFavorite}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60"
            title={isFavorite ? "Favorita" : "Favoritar"}
          >
            <span className="text-lg" aria-hidden>{isFavorite ? "★" : "☆"}</span>
          </button>
          <button type="button" onClick={() => openSectionPanel("trechos")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2" title="Trechos destacados" aria-label="Trechos destacados">
            <BookMarked className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={() => openSectionPanel("material")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2" title="Material complementar" aria-label="Material complementar">
            <FileText className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={() => openSectionPanel("anotacoes")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2" title="Bloco de anotações" aria-label="Bloco de anotações">
            <StickyNote className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={() => openSectionPanel("duvidas")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2" title="Dúvidas sobre esta aula" aria-label="Dúvidas">
            <MessageCircleQuestion className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={() => prog?.completed && openSectionPanel("exercicios")} disabled={!prog?.completed} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[var(--card-bg)]" title={prog?.completed ? "Exercícios" : "Conclua a aula para acessar os exercícios"} aria-label="Exercícios">
            <ClipboardList className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-secondary)] shadow-md hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          style={{ bottom: showFloatingActions ? "5.5rem" : "1.5rem" }}
          title="Voltar ao topo"
          aria-label="Voltar ao topo"
        >
          <ArrowUp className="h-5 w-5" aria-hidden />
        </button>
      )}
      <nav aria-label="Navegação da aula">
        <Link
          href={`/minhas-turmas/${enrollmentId}/conteudo`}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          data-tour="aula-voltar"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
          Voltar ao conteúdo
        </Link>
        <p className="mt-2 text-xs font-medium text-[var(--text-muted)]">
          <span className="text-[var(--igh-primary)]">{moduleTitle}</span>
          {aulaPosicao ? <span aria-hidden> · </span> : null}
          {aulaPosicao ? <span>{aulaPosicao}</span> : null}
        </p>
      </nav>

      <nav
        aria-label="Navegação entre aulas"
        className="flex flex-nowrap items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/90 px-4 py-3 shadow-sm backdrop-blur-sm"
        data-tour="aula-nav-aulas"
      >
        <div className="flex shrink-0">
          {prevLesson ? (
            <Link
              href={`/minhas-turmas/${enrollmentId}/conteudo/aula/${prevLesson.id}`}
              aria-label="Aula anterior"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm font-semibold text-[var(--igh-primary)] transition hover:border-[var(--igh-primary)]/35 hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:px-4 sm:py-2"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Aula anterior</span>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm text-[var(--text-muted)] sm:px-4 sm:py-2">
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Aula anterior</span>
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 justify-center">
          <Link
            href="/minhas-turmas/favoritos"
            aria-label="Favoritos"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm font-semibold text-[var(--igh-primary)] transition hover:border-[var(--igh-primary)]/35 hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:px-4 sm:py-2"
          >
            <BookMarked className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Favoritos</span>
          </Link>
        </div>
        <div className="flex shrink-0">
          {nextLesson ? (
            mustAnswerExercisesBeforeNext ? (
              <button
                type="button"
                onClick={() => {
                  toast.push(
                    "error",
                    "Responda todos os exercícios desta aula antes de avançar para a próxima."
                  );
                  openSectionPanel("exercicios");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm text-[var(--text-muted)] transition hover:border-[var(--igh-primary)]/25 hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:px-4 sm:py-2"
              >
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Próxima aula</span>
              </button>
            ) : (
              <Link
                href={`/minhas-turmas/${enrollmentId}/conteudo/aula/${nextLesson.id}`}
                aria-label="Próxima aula"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm font-semibold text-[var(--igh-primary)] transition hover:border-[var(--igh-primary)]/35 hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:px-4 sm:py-2"
              >
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Próxima aula</span>
              </Link>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm text-[var(--text-muted)] sm:px-4 sm:py-2">
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Próxima aula</span>
            </span>
          )}
        </div>
      </nav>

      <div ref={headerActionsRef} data-tour="aula-header">
        <DashboardHero
          eyebrow={moduleTitle}
          title={lesson.title}
          description={
            <span>
              <span className="font-medium text-[var(--text-primary)]">{data.courseName}</span>
              {aulaPosicao ? (
                <>
                  <span className="text-[var(--text-muted)]"> · </span>
                  <span>{aulaPosicao}</span>
                </>
              ) : null}
            </span>
          }
          rightSlot={
            <button
              type="button"
              onClick={handleToggleFavorite}
              disabled={togglingFavorite}
              aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              aria-pressed={isFavorite}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] shadow-sm transition hover:border-[var(--igh-primary)]/35 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60"
              title={isFavorite ? "Favorita" : "Favoritar"}
            >
              <span className="text-xl" aria-hidden>
                {isFavorite ? "★" : "☆"}
              </span>
            </button>
          }
        />
      </div>

      <div className="flex flex-col gap-8">
          <SectionCard
            id="progress-heading"
            title="Progresso e histórico"
            description="Status da aula e registro do seu estudo nesta lição."
            variant="elevated"
            dataTour="aula-progresso"
          >
            <div
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-3"
              data-tour="aula-progresso-inner"
            >
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
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
                  className="rounded-xl bg-[var(--igh-primary)] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[var(--igh-primary)]/20 transition hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {markingComplete ? "Salvando..." : "Marcar como concluída"}
                </button>
              )}
            </div>

            <div className="mt-6 border-t border-[var(--card-border)] pt-6" data-tour="aula-historico">
              <h3 className="mb-3 text-sm font-bold text-[var(--text-primary)]">Histórico de estudo</h3>
              <dl className="grid gap-4 text-sm sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Último acesso</dt>
                  <dd className="mt-1 font-semibold text-[var(--text-primary)]">
                    {prog.lastAccessedAt ? formatNoteDate(prog.lastAccessedAt) : "—"}
                  </dd>
                </div>
                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tempo estudado</dt>
                  <dd className="mt-1 font-semibold text-[var(--text-primary)]">
                    {formatStudyDuration(prog.totalMinutesStudied)}
                  </dd>
                </div>
                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Conclusão</dt>
                  <dd className="mt-1 font-semibold text-[var(--text-primary)]">
                    {prog.completedAt ? formatNoteDate(prog.completedAt) : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </SectionCard>

          {/* Menu do painel: no PC expandido (nomes visíveis); no mobile só ícones até expandir. */}
          <div ref={sectionsBarRef} id="secoes" className="scroll-mt-24" data-tour="aula-secoes">
          <SectionCard
            title="Seções da aula"
            description="Trechos salvos, material, anotações, exercícios (após concluir a aula) e dúvidas."
          >
            <nav aria-label="Seções da aula" className="flex flex-wrap items-center gap-2">
            {!panelMenuCollapsed ? (
              <>
                <button
                  type="button"
                  onClick={() => openSectionPanel("trechos")}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                    openSection === "trechos"
                      ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                  }`}
                  aria-pressed={openSection === "trechos"}
                  data-tour="aula-btn-trechos"
                >
                  <BookMarked className="h-4 w-4 shrink-0" aria-hidden />
                  Trechos destacados
                </button>
                <button
                  type="button"
                  onClick={() => openSectionPanel("material")}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                    openSection === "material"
                      ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                  }`}
                  aria-pressed={openSection === "material"}
                  data-tour="aula-btn-material"
                >
                  <FileText className="h-4 w-4 shrink-0" aria-hidden />
                  Material complementar
                </button>
                <button
                  type="button"
                  onClick={() => openSectionPanel("anotacoes")}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                    openSection === "anotacoes"
                      ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                  }`}
                  aria-pressed={openSection === "anotacoes"}
                  data-tour="aula-btn-anotacoes"
                >
                  <StickyNote className="h-4 w-4 shrink-0" aria-hidden />
                  Bloco de anotações
                </button>
                <button
                  type="button"
                  onClick={() => prog?.completed && openSectionPanel("exercicios")}
                  disabled={!prog?.completed}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[var(--card-bg)] ${
                    openSection === "exercicios"
                      ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                  }`}
                  aria-pressed={openSection === "exercicios"}
                  title={prog?.completed ? undefined : "Conclua a aula para acessar os exercícios"}
                  data-tour="aula-btn-exercicios"
                >
                  <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
                  Exercícios
                </button>
                <button
                  type="button"
                  onClick={() => openSectionPanel("duvidas")}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                    openSection === "duvidas"
                      ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                  }`}
                  aria-pressed={openSection === "duvidas"}
                  data-tour="aula-btn-duvidas"
                >
                  <MessageCircleQuestion className="h-4 w-4 shrink-0" aria-hidden />
                  Dúvidas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPanelMenuCollapsed(true);
                    setOpenSection(null);
                    const path = `/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}`;
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete("secao");
                    const qs = params.toString();
                    router.replace(qs ? `${path}?${qs}#secoes` : `${path}#secoes`);
                    setTimeout(() => {
                      document.getElementById("secoes")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 150);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                  title="Recolher menu"
                  aria-label="Recolher menu"
                >
                  <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                  Recolher
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openSectionPanel("trechos")}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                    openSection === "trechos"
                      ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                  }`}
                  title="Trechos destacados"
                  aria-label="Trechos destacados"
                  aria-pressed={openSection === "trechos"}
                  data-tour="aula-btn-trechos"
                >
                  <BookMarked className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => openSectionPanel("material")}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                    openSection === "material"
                      ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                  }`}
                  title="Material complementar"
                  aria-label="Material complementar"
                  aria-pressed={openSection === "material"}
                  data-tour="aula-btn-material"
                >
                  <FileText className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => openSectionPanel("anotacoes")}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                    openSection === "anotacoes"
                      ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                  }`}
                  title="Bloco de anotações"
                  aria-label="Bloco de anotações"
                  aria-pressed={openSection === "anotacoes"}
                  data-tour="aula-btn-anotacoes"
                >
                  <StickyNote className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => prog?.completed && openSectionPanel("exercicios")}
                  disabled={!prog?.completed}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[var(--card-bg)] ${
                    openSection === "exercicios"
                      ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                  }`}
                  title={prog?.completed ? "Exercícios" : "Conclua a aula para acessar os exercícios"}
                  aria-label="Exercícios"
                  aria-pressed={openSection === "exercicios"}
                  data-tour="aula-btn-exercicios"
                >
                  <ClipboardList className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => openSectionPanel("duvidas")}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 ${
                    openSection === "duvidas"
                      ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                  }`}
                  title="Dúvidas"
                  aria-label="Dúvidas"
                  aria-pressed={openSection === "duvidas"}
                  data-tour="aula-btn-duvidas"
                >
                  <MessageCircleQuestion className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setPanelMenuCollapsed(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                  title="Expandir menu"
                  aria-label="Expandir menu"
                >
                  <ChevronDown className="h-5 w-5" aria-hidden />
                </button>
              </>
            )}
            </nav>
          </SectionCard>
          </div>

          {openSection && (
            <div ref={sectionPanelRef} className="scroll-mt-24 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/95 p-4 shadow-sm backdrop-blur-sm sm:p-5">
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
                                <div className="mt-3 flex flex-wrap items-center gap-3">
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
                  <h2 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">Dúvidas sobre esta aula</h2>
                  <p className="mb-3 text-xs text-[var(--text-muted)]">Envie sua dúvida ou comente sobre a aula. Você pode editar seus próprios comentários. Qualquer aluno pode responder a um comentário.</p>
                  <div className="mb-4 flex flex-col gap-2">
                    <textarea
                      value={questionContent}
                      onChange={(e) => setQuestionContent(e.target.value)}
                      placeholder="Enviar dúvida sobre esta aula..."
                      rows={3}
                      className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                    <button
                      type="button"
                      onClick={handleSendQuestion}
                      disabled={savingQuestion || !questionContent.trim()}
                      className="self-start rounded bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {savingQuestion ? "Enviando..." : "Enviar dúvida"}
                    </button>
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
                                    <textarea
                                      value={editQuestionContent}
                                      onChange={(e) => setEditQuestionContent(e.target.value)}
                                      rows={3}
                                      className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--igh-primary)]"
                                      placeholder="Editar comentário..."
                                    />
                                    <div className="flex gap-2">
                                      <button type="button" onClick={handleSaveEditQuestion} disabled={savingEditQuestionId === q.id || !editQuestionContent.trim()} className="rounded bg-[var(--igh-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60">
                                        {savingEditQuestionId === q.id ? "Salvando..." : "Salvar"}
                                      </button>
                                      <button type="button" onClick={cancelEditQuestion} disabled={savingEditQuestionId === q.id} className="rounded border border-[var(--card-border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] disabled:opacity-60">
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="whitespace-pre-wrap text-[var(--text-primary)]">{q.content}</p>
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
            <SectionCard title="Vídeo da aula" variant="elevated" dataTour="aula-video">
              <div className="flex justify-center overflow-hidden rounded-xl bg-black shadow-inner">
                <div className="aspect-video w-full max-w-3xl">
                  <LessonVideoPlayer videoUrl={lesson.videoUrl} />
                </div>
              </div>
            </SectionCard>
          )}

          {lesson.contentRich && lesson.contentRich.trim() && (
            <div id="conteudo" className="scroll-mt-24" data-tour="aula-conteudo">
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
                    <nav aria-label="Páginas do conteúdo" className="flex flex-wrap items-center gap-2" data-tour="aula-slides">
                      <button
                        type="button"
                        onClick={() => {
                          const prev = Math.max(0, contentPageIndex - 1);
                          const apiUrl = `/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`;
                          const body = JSON.stringify({ lastContentPageIndex: prev });
                          console.log("[Slide] Clique em Slide anterior → sendBeacon + fetch índice", prev, "(página", prev + 1, ")");
                          navigator.sendBeacon(apiUrl, new Blob([body], { type: "application/json" }));
                          persistSlideIndex(prev, "clique Slide anterior");
                          router.replace(`/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}?pagina=${prev + 1}#conteudo`);
                          setTimeout(() => contentWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                        }}
                        disabled={contentPageIndex === 0}
                        aria-label="Slide anterior"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:px-3 sm:py-1.5"
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
                          onClick={() => {
                            const first = 0;
                            const apiUrl = `/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`;
                            const body = JSON.stringify({ lastContentPageIndex: first });
                            navigator.sendBeacon(apiUrl, new Blob([body], { type: "application/json" }));
                            persistSlideIndex(first, "clique Primeiro slide");
                            router.replace(`/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}?pagina=1#conteudo`);
                            setTimeout(() => contentWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                          }}
                          aria-label="Primeiro slide"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:px-3 sm:py-1.5"
                        >
                          <ChevronsLeft className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="hidden sm:inline">Primeiro slide</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const next = contentPageIndex + 1;
                            const apiUrl = `/api/me/enrollments/${enrollmentId}/lesson-progress/${lessonId}`;
                            const body = JSON.stringify({ lastContentPageIndex: next });
                            console.log("[Slide] Clique em Próximo slide → sendBeacon + fetch índice", next, "(página", next + 1, ")");
                            navigator.sendBeacon(apiUrl, new Blob([body], { type: "application/json" }));
                            persistSlideIndex(next, "clique Próximo slide");
                            router.replace(`/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}?pagina=${next + 1}#conteudo`);
                            setTimeout(() => contentWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                          }}
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
                  <div className="flex items-center gap-1" data-tour="aula-fonte">
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
                    onClick={() => window.dispatchEvent(new CustomEvent("highlightable-content-destacar"))}
                    disabled={savingPassage}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60 sm:px-3 sm:py-1.5"
                    title={savingPassage ? "Salvando..." : "Destacar trecho selecionado"}
                    aria-label={savingPassage ? "Salvando..." : "Destacar trecho selecionado"}
                    data-tour="aula-destacar-trecho"
                  >
                    <Highlighter className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">{savingPassage ? "Salvando..." : "Destacar trecho selecionado"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      document.fullscreenElement === contentWrapperRef.current
                        ? document.exitFullscreen()
                        : contentWrapperRef.current?.requestFullscreen()
                    }
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 sm:px-3 sm:py-1.5"
                    title={isContentFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                    aria-label={isContentFullscreen ? "Sair da tela cheia" : "Expandir em tela cheia"}
                    data-tour="aula-tela-cheia"
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
                      passages={passagesForCurrentPage}
                      onSavePassage={handleSavePassageForPage}
                      saving={savingPassage}
                      hideDestacarButton
                      onWarning={(msg) => toast.push("error", msg)}
                    />
                  </div>
                </div>
              </div>
            </SectionCard>
            </div>
          )}


          {!lesson.videoUrl && !(lesson.contentRich && lesson.contentRich.trim()) && lesson.imageUrls.length === 0 && !(lesson.summary && lesson.summary.trim()) && (!lesson.attachmentUrls || lesson.attachmentUrls.length === 0) && (
            <SectionCard title="Conteúdo" description="Esta aula ainda não tem material principal cadastrado.">
              <p className="text-center text-sm text-[var(--text-muted)]">Nenhum conteúdo adicional para esta aula.</p>
            </SectionCard>
          )}

          <section id="anotacoes-legacy" className="hidden" aria-hidden>
            <h2 id="anotacoes-heading" className="mb-1 text-base font-semibold text-[var(--text-primary)]">
              Bloco de anotações
            </h2>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              Suas anotações ficam salvas por aula. Opcionalmente, informe o minuto do vídeo (ex.: 12:34 ou 5).
            </p>
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
                <label htmlFor="note-minute" className="text-xs text-[var(--text-muted)]">
                  Minuto do vídeo (opcional):
                </label>
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
            {notes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                Nenhuma anotação ainda. Use o campo acima para registrar suas ideias durante a aula.
              </p>
            ) : (
              <ul className="space-y-3">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-baseline gap-2 text-xs text-[var(--text-muted)]">
                        <span>{formatNoteDate(note.createdAt)}</span>
                        {note.videoTimestampLabel != null && (
                          <span className="font-medium text-[var(--igh-secondary)]">
                            · Vídeo {note.videoTimestampLabel}
                          </span>
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
            )}
          </section>

      </div>

        <section aria-label="Atalhos úteis" className="pb-2">
          <h2 className="mb-1 text-lg font-bold text-[var(--text-primary)]">Atalhos úteis</h2>
          <p className="mb-4 text-sm text-[var(--text-muted)]">Volte ao curso, veja exercícios da turma ou sua matrícula.</p>
          <QuickActionGrid
            items={[
              {
                href: `/minhas-turmas/${enrollmentId}/conteudo`,
                label: "Conteúdo do curso",
                description: "Módulos e lista de aulas",
                icon: BookOpen,
                accent: "from-[var(--igh-primary)] to-violet-600",
              },
              {
                href: `/minhas-turmas/${enrollmentId}/exercicios`,
                label: "Exercícios da turma",
                description: "Acertos e revisão por aula",
                icon: ListVideo,
                accent: "from-sky-500 to-cyan-600",
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
                icon: BookMarked,
                accent: "from-amber-500 to-orange-600",
              },
            ]}
          />
        </section>
    </div>
  );
}
