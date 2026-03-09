"use client";

import {
  ArrowUp,
  BookMarked,
  ClipboardList,
  FileText,
  Highlighter,
  MessageCircleQuestion,
  StickyNote,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
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

/** Nome amigável para download: extrai da URL ou usa "Arquivo de apoio N". */
function getAttachmentLabel(url: string, index: number): string {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split("/").filter(Boolean).pop();
    if (name && name.length > 0) return decodeURIComponent(name);
  } catch {}
  return `Arquivo de apoio ${index + 1}`;
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
  const enrollmentId = params?.id as string;
  const lessonId = params?.lessonId as string;
  const toast = useToast();
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
  type LessonQuestionReply = { id: string; content: string; createdAt: string; enrollmentId: string; authorName: string };
  type LessonQuestion = {
    id: string;
    content: string;
    createdAt: string;
    updatedAt?: string;
    enrollmentId: string;
    authorName: string;
    replies?: LessonQuestionReply[];
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
  const [showFloatingActions, setShowFloatingActions] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

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
    if (data && findLesson(data.modules, lessonId)?.lesson.isLiberada) {
      void loadProgress();
      void loadNotes();
      void loadPassages();
      void loadFavorite();
      void loadExercises();
      void loadQuestions();
    }
  }, [data, lessonId, loadProgress, loadNotes, loadPassages, loadFavorite, loadExercises, loadQuestions]);

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

  useLayoutEffect(() => {
    if (!showLessonCard) return;
    const el = headerActionsRef.current;
    if (!el) return;
    const updateVisibility = () => {
      const rect = el.getBoundingClientRect();
      setShowFloatingActions(rect.bottom < 0);
    };
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry) setShowFloatingActions(!entry.isIntersecting);
      },
      { threshold: 0, root: null, rootMargin: "0px" }
    );
    obs.observe(el);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => {
      obs.disconnect();
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

  if (loading || !data) {
    return (
      <div className="container-page flex flex-col gap-6">
        <Link className="text-sm text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded" href={`/minhas-turmas/${enrollmentId}/conteudo`}>
          ← Voltar ao conteúdo
        </Link>
        <div className="card">
          <div className="card-body py-8 text-center text-[var(--text-secondary)]">
            {loading ? "Carregando aula..." : "Aula não encontrada."}
          </div>
        </div>
      </div>
    );
  }

  const found = foundForEffect;
  if (!found || !found.lesson.isLiberada) {
    return (
      <div className="container-page flex flex-col gap-6">
        <Link className="text-sm text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded" href={`/minhas-turmas/${enrollmentId}/conteudo`}>
          ← Voltar ao conteúdo
        </Link>
        <div className="card">
          <div className="card-body py-8 text-center text-[var(--text-secondary)]">
            {found ? "Esta aula ainda não está liberada." : "Aula não encontrada."}
          </div>
        </div>
      </div>
    );
  }

  const { lesson, moduleTitle } = found;

  /** PDF da aula é gerado automaticamente quando há resumo ou conteúdo. */
  const hasPdfToDownload =
    !!(lesson.summary && lesson.summary.trim()) || !!(lesson.contentRich && lesson.contentRich.trim());

  const handleSavePassage = async (payload: { text: string; startOffset: number }) => {
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
      if (res.ok && json?.ok) {
        setPassages((prev) => [...prev, json.data]);
        toast.push("success", "Trecho destacado salvo.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível salvar o trecho.");
      }
    } finally {
      setSavingPassage(false);
    }
  };

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
  };

  const orderedLessons = getOrderedLessons(data.modules);
  const currentIndex = orderedLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? orderedLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < orderedLessons.length - 1 ? orderedLessons[currentIndex + 1] : null;

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

  return (
    <div className="container-page flex flex-col gap-6">
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
          <a href="#trechos-destacados" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2" title="Trechos destacados" aria-label="Ir para Trechos destacados">
            <BookMarked className="h-5 w-5" aria-hidden />
          </a>
          <a href="#material-complementar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2" title="Material complementar" aria-label="Ir para Material complementar">
            <FileText className="h-5 w-5" aria-hidden />
          </a>
          <a href="#anotacoes" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2" title="Bloco de anotações" aria-label="Ir para Bloco de anotações">
            <StickyNote className="h-5 w-5" aria-hidden />
          </a>
          <a href="#duvidas" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2" title="Dúvidas sobre esta aula" aria-label="Ir para Dúvidas sobre esta aula">
            <MessageCircleQuestion className="h-5 w-5" aria-hidden />
          </a>
          <a href="#exercicios" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2" title="Exercícios" aria-label="Ir para Exercícios">
            <ClipboardList className="h-5 w-5" aria-hidden />
          </a>
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
      <nav aria-label="Navegação da aula" className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={`/minhas-turmas/${enrollmentId}/conteudo`}
          className="text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
        >
          ← Voltar ao conteúdo
        </Link>
        <span className="text-[var(--text-muted)]" aria-hidden>·</span>
        <span className="text-[var(--text-muted)]">{moduleTitle}</span>
      </nav>

      <nav
        aria-label="Navegação entre aulas"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-3"
      >
        {prevLesson ? (
          <Link
            href={`/minhas-turmas/${enrollmentId}/conteudo/aula/${prevLesson.id}`}
            className="rounded px-2 py-1 text-sm font-medium text-[var(--igh-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          >
            ← Anterior
          </Link>
        ) : (
          <span className="rounded px-2 py-1 text-sm text-[var(--text-muted)]">← Anterior</span>
        )}
        <span className="text-[var(--card-border)]" aria-hidden>|</span>
        <Link
          href={`/minhas-turmas/${enrollmentId}/conteudo`}
          className="rounded px-2 py-1 text-sm font-medium text-[var(--igh-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
        >
          Visão do módulo
        </Link>
        <span className="text-[var(--card-border)]" aria-hidden>|</span>
        <Link
          href="/minhas-turmas/favoritos"
          className="rounded px-2 py-1 text-sm font-medium text-[var(--igh-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
        >
          Favoritos
        </Link>
        <span className="text-[var(--card-border)]" aria-hidden>|</span>
        {nextLesson ? (
          <Link
            href={`/minhas-turmas/${enrollmentId}/conteudo/aula/${nextLesson.id}`}
            className="rounded px-2 py-1 text-sm font-medium text-[var(--igh-primary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          >
            Próxima →
          </Link>
        ) : (
          <span className="rounded px-2 py-1 text-sm text-[var(--text-muted)]">Próxima →</span>
        )}
      </nav>

      <div className="card">
        <div ref={headerActionsRef} className="card-header flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--text-muted)]">{moduleTitle}</p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
              {lesson.title}
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleFavorite}
              disabled={togglingFavorite}
              aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              aria-pressed={isFavorite}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-secondary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60"
              title={isFavorite ? "Favorita" : "Favoritar"}
            >
              <span className="text-lg" aria-hidden>{isFavorite ? "★" : "☆"}</span>
            </button>
            <a
              href="#trechos-destacados"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-secondary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              title="Trechos destacados"
              aria-label="Ir para Trechos destacados"
            >
              <BookMarked className="h-5 w-5" aria-hidden />
            </a>
            <a
              href="#material-complementar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-secondary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              title="Material complementar"
              aria-label="Ir para Material complementar"
            >
              <FileText className="h-5 w-5" aria-hidden />
            </a>
            <a
              href="#anotacoes"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-secondary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              title="Bloco de anotações"
              aria-label="Ir para Bloco de anotações"
            >
              <StickyNote className="h-5 w-5" aria-hidden />
            </a>
            <a
              href="#duvidas"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-secondary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              title="Dúvidas sobre esta aula"
              aria-label="Ir para Dúvidas sobre esta aula"
            >
              <MessageCircleQuestion className="h-5 w-5" aria-hidden />
            </a>
            <a
              href="#exercicios"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-secondary)] hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              title="Exercícios"
              aria-label="Ir para Exercícios"
            >
              <ClipboardList className="h-5 w-5" aria-hidden />
            </a>
          </div>
        </div>
        <div className="card-body space-y-8">
          <section
            className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-3"
            aria-labelledby="progress-heading"
          >
            <h2 id="progress-heading" className="sr-only">Progresso da aula</h2>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                prog.completed
                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
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
                className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {markingComplete ? "Salvando..." : "Marcar como concluída"}
              </button>
            )}
          </section>

          <section
            className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-3"
            aria-labelledby="historico-heading"
          >
            <h2 id="historico-heading" className="mb-3 text-base font-semibold text-[var(--text-primary)]">
              Histórico de estudo
            </h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[var(--text-muted)]">Última vez que acessou</dt>
                <dd className="font-medium text-[var(--text-primary)]">
                  {prog.lastAccessedAt ? formatNoteDate(prog.lastAccessedAt) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Quanto tempo estudou</dt>
                <dd className="font-medium text-[var(--text-primary)]">
                  {formatStudyDuration(prog.totalMinutesStudied)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Quando concluiu</dt>
                <dd className="font-medium text-[var(--text-primary)]">
                  {prog.completedAt ? formatNoteDate(prog.completedAt) : "—"}
                </dd>
              </div>
            </dl>
          </section>

          {lesson.summary && lesson.summary.trim() && (
            <section
              className="rounded-lg border border-[var(--card-border)] border-l-4 border-l-[var(--igh-primary)] bg-[var(--igh-surface)] p-4 pl-4"
              aria-labelledby="resumo-heading"
            >
              <h2 id="resumo-heading" className="mb-1 text-base font-semibold text-[var(--text-primary)]">
                Resumo rápido da aula
              </h2>
              <p className="mb-2 text-xs text-[var(--text-muted)]">
                O que você vai aprender:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                {lesson.summary
                  .trim()
                  .split(/\n/)
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, i) => (
                    <li key={i}>{line.replace(/^[•\-*]\s*/, "")}</li>
                  ))}
              </ul>
            </section>
          )}

          {lesson.videoUrl && (
            <section className="flex justify-center rounded-lg overflow-hidden bg-black" aria-label="Vídeo da aula">
              <div className="aspect-video w-full max-w-3xl">
                <LessonVideoPlayer videoUrl={lesson.videoUrl} />
              </div>
            </section>
          )}

          {lesson.contentRich && lesson.contentRich.trim() && (
            <section id="trechos-destacados">
              <HighlightableContentViewer
                content={lesson.contentRich}
                passages={passages}
                onSavePassage={handleSavePassage}
                saving={savingPassage}
              />
              {passages.length > 0 && (
                <div className="mt-4 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4">
                  <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                    Trechos destacados
                  </h3>
                  <ul className="space-y-2">
                    {passages.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 text-[var(--text-primary)]">
                          &ldquo;{p.text}&rdquo;
                        </span>
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
                </div>
              )}
            </section>
          )}

          {(hasPdfToDownload || (lesson.attachmentUrls?.length ?? 0) > 0) && (
            <section id="material-complementar" className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4" aria-labelledby="material-heading">
              <h2 id="material-heading" className="mb-1 text-base font-semibold text-[var(--text-primary)]">
                Material complementar
              </h2>
              <p className="mb-4 text-xs text-[var(--text-muted)]">
                Baixe o PDF da aula e os arquivos de apoio para estudar offline.
              </p>
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
                  const label = getAttachmentLabel(url, i);
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
            </section>
          )}

          {!lesson.videoUrl && !(lesson.contentRich && lesson.contentRich.trim()) && lesson.imageUrls.length === 0 && !(lesson.summary && lesson.summary.trim()) && (!lesson.attachmentUrls || lesson.attachmentUrls.length === 0) && exercises.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">Nenhum conteúdo adicional para esta aula.</p>
          )}

          <section id="anotacoes" className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4" aria-labelledby="anotacoes-heading">
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

          <section id="duvidas" className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-4">
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">
              Dúvidas sobre esta aula
            </h2>
            <p className="mb-3 text-xs text-[var(--text-muted)]">
              Envie sua dúvida ou comente sobre a aula. Você pode editar seus próprios comentários. Qualquer aluno pode responder a um comentário.
            </p>
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
            {questions.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Nenhuma dúvida ou comentário ainda. Seja o primeiro a enviar.</p>
            ) : (
              <ul className="space-y-3">
                {questions.map((q) => (
                  <li
                    key={q.id}
                    className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-baseline gap-2 text-xs text-[var(--text-muted)]">
                          <span className="font-medium text-[var(--text-secondary)]">{q.authorName}</span>
                          <span>{formatNoteDate(q.createdAt)}</span>
                          {q.updatedAt && q.updatedAt !== q.createdAt && (
                            <span className="italic">(editado)</span>
                          )}
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
                              <button
                                type="button"
                                onClick={handleSaveEditQuestion}
                                disabled={savingEditQuestionId === q.id || !editQuestionContent.trim()}
                                className="rounded bg-[var(--igh-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                              >
                                {savingEditQuestionId === q.id ? "Salvando..." : "Salvar"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditQuestion}
                                disabled={savingEditQuestionId === q.id}
                                className="rounded border border-[var(--card-border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] disabled:opacity-60"
                              >
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
                          <button
                            type="button"
                            onClick={() => startEditQuestion(q)}
                            className="rounded px-2 py-1 text-xs font-medium text-[var(--igh-primary)] hover:bg-[var(--igh-surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
                            title="Editar comentário"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q.id)}
                            disabled={removingQuestionId === q.id}
                            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-60"
                            title="Excluir dúvida"
                          >
                            {removingQuestionId === q.id ? "Excluindo..." : "Excluir"}
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Respostas ao comentário */}
                    <div className="mt-3 border-t border-[var(--card-border)] pt-3 pl-3">
                      {(q.replies ?? []).length > 0 && (
                        <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
                          Respostas ({(q.replies ?? []).length})
                        </p>
                      )}
                      {(q.replies ?? []).map((r) => (
                        <div
                          key={r.id}
                          className="mb-2 flex flex-wrap items-baseline gap-2 text-xs"
                        >
                          <span className="font-medium text-[var(--text-secondary)]">{r.authorName}</span>
                          <span className="text-[var(--text-muted)]">{formatNoteDate(r.createdAt)}</span>
                          <p className="w-full whitespace-pre-wrap text-[var(--text-primary)]">{r.content}</p>
                        </div>
                      ))}
                      {replyingToQuestionId === q.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            rows={2}
                            className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--igh-primary)]"
                            placeholder="Escreva sua resposta..."
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSendReply(q.id)}
                              disabled={savingReplyQuestionId === q.id || !replyContent.trim()}
                              className="rounded bg-[var(--igh-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                            >
                              {savingReplyQuestionId === q.id ? "Enviando..." : "Enviar resposta"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelReply}
                              disabled={savingReplyQuestionId === q.id}
                              className="rounded border border-[var(--card-border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] disabled:opacity-60"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startReply(q.id)}
                          className="text-xs font-medium text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
                          title="Responder ao comentário"
                        >
                          Responder ao comentário
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {exercises.length > 0 && (
            <section id="exercicios" className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4" aria-labelledby="exercicios-heading">
              <h2 id="exercicios-heading" className="mb-1 text-base font-semibold text-[var(--text-primary)]">
                Exercícios
              </h2>
              <p className="mb-4 text-xs text-[var(--text-muted)]">
                Responda às questões e clique em Verificar para conferir.
              </p>
              <ul className="space-y-6">
                {exercises.map((ex, idx) => {
                  const result = exerciseResult[ex.id];
                  const selectedId = exerciseSelected[ex.id];
                  const correctOptionText = result?.correctOptionId
                    ? ex.options.find((o) => o.id === result.correctOptionId)?.text
                    : null;
                  return (
                    <li
                      key={ex.id}
                      className="rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] p-4"
                    >
                      <p className="mb-3 font-medium text-[var(--text-primary)]">
                        {idx + 1}. {ex.question}
                      </p>
                      <div className="space-y-2">
                        {ex.options.map((opt) => (
                          <label
                            key={opt.id}
                            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                              result
                                ? opt.id === result.correctOptionId
                                  ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                                  : selectedId === opt.id && !result.correct
                                    ? "border-red-400 bg-red-50 dark:bg-red-950/30"
                                    : "border-[var(--card-border)]"
                                : "border-[var(--card-border)] hover:bg-[var(--igh-surface)] focus-within:ring-2 focus-within:ring-[var(--igh-primary)] focus-within:ring-offset-1"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`exercise-${ex.id}`}
                              checked={selectedId === opt.id}
                              onChange={() =>
                                setExerciseSelected((prev) => ({ ...prev, [ex.id]: opt.id }))
                              }
                              disabled={!!result}
                              className="mt-0.5 shrink-0"
                            />
                            <span className="text-[var(--text-secondary)]">{opt.text}</span>
                          </label>
                        ))}
                      </div>
                      {result ? (
                        <p
                          className={`mt-3 text-sm font-medium ${
                            result.correct ? "text-green-600" : "text-amber-600"
                          }`}
                        >
                          {result.correct
                            ? "✓ Correto!"
                            : correctOptionText
                              ? `Resposta correta: ${correctOptionText}`
                              : "Resposta incorreta."}
                        </p>
                      ) : (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => handleSubmitExercise(ex.id)}
                            disabled={submittingExerciseId === ex.id || !selectedId}
                            aria-busy={submittingExerciseId === ex.id}
                            className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-60"
                          >
                            {submittingExerciseId === ex.id ? "Verificando..." : "Verificar"}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
