"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { examOptionLabel } from "@/lib/exam-option-labels";
import type { ApiErr, ApiResponse } from "@/lib/api-types";

const LEAVE_MSG =
  "Se você sair agora, a prova será encerrada com as respostas já marcadas. Deseja realmente sair?";

type ExamInfo = {
  id: string;
  title: string;
  instructions: string | null;
  durationMinutes: number;
  timingMode: string;
  canStart: boolean;
  startBlockedReason: string | null;
};

type Question = {
  id: string;
  order: number;
  questionText: string;
  options: { id: string; text: string; order: number }[];
  selectedOptionId?: string | null;
};

type AttemptState = {
  attemptId: string;
  status: string;
  remainingSeconds: number;
  questions: Question[];
  result: {
    scorePercent?: number | null;
    correctCount?: number | null;
    totalQuestions?: number | null;
    submitted?: boolean;
  } | null;
  exam: { title: string; instructions: string | null };
};

export default function StudentExamPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const enrollmentId = params.id as string;
  const examId = params.examId as string;

  const [loading, setLoading] = useState(true);
  const [examInfo, setExamInfo] = useState<ExamInfo | null>(null);
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const leavingRef = useRef(false);

  const inProgress = attempt?.status === "IN_PROGRESS";

  const load = useCallback(async () => {
    const res = await fetch(`/api/me/enrollments/${enrollmentId}/exams/${examId}`, {
      credentials: "include",
    });
    const json = (await res.json()) as ApiResponse<{
      exam: ExamInfo;
      attempt: AttemptState | null;
    }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao carregar prova.");
      return;
    }
    setExamInfo(json.data.exam);
    setAttempt(json.data.attempt);
    if (json.data.attempt) {
      setRemaining(json.data.attempt.remainingSeconds);
      const sel: Record<string, string> = {};
      for (const q of json.data.attempt.questions) {
        if (q.selectedOptionId) sel[q.id] = q.selectedOptionId;
      }
      setSelections(sel);
    }
  }, [enrollmentId, examId, toast]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const submitExam = useCallback(
    async (abandon: boolean) => {
      if (submitting || leavingRef.current) return;
      setSubmitting(true);
      leavingRef.current = true;
      try {
        const answers = Object.entries(selections).map(([attemptQuestionId, optionId]) => ({
          attemptQuestionId,
          optionId,
        }));
        const res = await fetch(
          `/api/me/enrollments/${enrollmentId}/exams/${examId}/attempt/submit`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers, abandon }),
          }
        );
        const json = (await res.json()) as ApiResponse<{ attempt: AttemptState }>;
        if (!res.ok || !json.ok) {
          toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao enviar.");
          leavingRef.current = false;
          return;
        }
        setAttempt(json.data.attempt);
        setRemaining(0);
        if (abandon) {
          router.replace(`/minhas-turmas/${enrollmentId}`);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [selections, enrollmentId, examId, submitting, toast, router]
  );

  const startExam = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/me/enrollments/${enrollmentId}/exams/${examId}/start`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as ApiResponse<{ attempt: AttemptState }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as ApiErr).error.message : "Não foi possível iniciar.");
        return;
      }
      setAttempt(json.data.attempt);
      setRemaining(json.data.attempt.remainingSeconds);
      setSelections({});
    } finally {
      setSubmitting(false);
    }
  }, [enrollmentId, examId, toast]);

  useEffect(() => {
    if (!inProgress) return;
    const t = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(t);
          void submitExam(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [inProgress, submitExam]);

  useEffect(() => {
    if (!inProgress) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [inProgress]);

  useEffect(() => {
    if (!inProgress) return;
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      const a = el.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      e.preventDefault();
      e.stopPropagation();
      if (window.confirm(LEAVE_MSG)) {
        void submitExam(true);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [inProgress, submitExam]);

  async function selectOption(questionId: string, optionId: string) {
    setSelections((prev) => ({ ...prev, [questionId]: optionId }));
    if (!inProgress) return;
    await fetch(`/api/me/enrollments/${enrollmentId}/exams/${examId}/attempt/answer`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptQuestionId: questionId, optionId }),
    });
  }

  function formatTimer(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-[var(--text-muted)]">
        Carregando prova…
      </div>
    );
  }

  if (!examInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-[var(--text-muted)]">
        Prova não encontrada.
      </div>
    );
  }

  const finished = attempt && attempt.status !== "IN_PROGRESS";

  if (!attempt && !finished) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 p-6 sm:p-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Prova</p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{examInfo.title}</h1>
          {examInfo.instructions ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
              {examInfo.instructions}
            </p>
          ) : null}
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            Duração máxima: <strong>{examInfo.durationMinutes} min</strong>
            {examInfo.timingMode === "FROM_EXAM_START"
              ? " (contada a partir do horário de início da prova — se você entrar atrasado, terá menos tempo)."
              : " (contada a partir do momento em que você clicar em Iniciar)."}
          </p>
        </div>
        {examInfo.canStart ? (
          <Button size="lg" disabled={submitting} onClick={() => void startExam()}>
            {submitting ? "Iniciando…" : "Iniciar prova"}
          </Button>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            {examInfo.startBlockedReason ?? "Esta prova não está disponível no momento."}
          </p>
        )}
      </div>
    );
  }

  if (finished && attempt) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 p-6 sm:p-10">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Prova encerrada</h1>
        {attempt.result?.scorePercent != null ? (
          <p className="text-lg text-[var(--text-secondary)]">
            Você acertou <strong>{attempt.result.correctCount}</strong> de{" "}
            <strong>{attempt.result.totalQuestions}</strong> ({attempt.result.scorePercent}%).
          </p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Suas respostas foram registradas.</p>
        )}
        <Button variant="secondary" onClick={() => router.push(`/minhas-turmas/${enrollmentId}`)}>
          Voltar à turma
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 border-b border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{attempt?.exam.title}</p>
            <p className="text-xs text-[var(--text-muted)]">Não saia desta página durante a prova.</p>
          </div>
          <div
            className={`shrink-0 rounded-lg px-3 py-1.5 text-lg font-bold tabular-nums ${
              remaining <= 60 ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" : "bg-[var(--igh-surface)] text-[var(--igh-primary)]"
            }`}
          >
            {formatTimer(remaining)}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="space-y-8">
          {attempt?.questions.map((q, idx) => (
            <div key={q.id} className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 sm:p-5">
              <p className="text-sm font-semibold text-[var(--text-muted)]">Questão {idx + 1}</p>
              <p className="mt-2 text-base font-medium text-[var(--text-primary)]">{q.questionText}</p>
              <div className="mt-4 flex flex-col gap-2">
                {q.options.map((opt, optIdx) => {
                  const selected = selections[q.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => void selectOption(q.id, opt.id)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                        selected
                          ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/10 font-medium text-[var(--text-primary)]"
                          : "border-[var(--card-border)] hover:border-[var(--igh-primary)]/40"
                      }`}
                    >
                      <span className="font-semibold">{examOptionLabel(optIdx)} </span>
                      <span>{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end pb-10">
          <Button
            size="lg"
            disabled={submitting}
            onClick={() => {
              if (window.confirm("Enviar a prova agora? Você não poderá alterar as respostas.")) {
                void submitExam(false);
              }
            }}
          >
            {submitting ? "Enviando…" : "Enviar prova"}
          </Button>
        </div>
      </main>
    </div>
  );
}
