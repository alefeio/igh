"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiResponse } from "@/lib/api-types";

type AttemptRow = {
  id: string;
  status: string;
  studentName: string;
  scorePercent: number | null;
  correctCount: number | null;
  totalQuestions: number | null;
  submittedAt: string | null;
};

type KeyQuestion = {
  order: number;
  questionText: string;
  lessonTitle: string | null;
  options: { id: string; label: string; text: string; isCorrect: boolean }[];
};

type ReviewQuestion = {
  id: string;
  order: number;
  questionText: string;
  options: {
    id: string;
    label: string;
    text: string;
    isCorrect: boolean;
    isSelected: boolean;
  }[];
  answered: boolean;
  correct: boolean;
};

const STATUS_PT: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  SUBMITTED: "Enviada",
  EXPIRED: "Tempo esgotado",
  ABANDONED: "Encerrada (saída)",
};

function QuestionBlock({
  order,
  questionText,
  lessonTitle,
  options,
  showStudentResult,
}: {
  order: number;
  questionText: string;
  lessonTitle?: string | null;
  options: {
    label: string;
    text: string;
    isCorrect: boolean;
    isSelected?: boolean;
  }[];
  showStudentResult?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
      <p className="text-sm font-semibold text-[var(--text-muted)]">
        Questão {order + 1}
        {lessonTitle ? ` · ${lessonTitle}` : ""}
      </p>
      <p className="mt-2 font-medium text-[var(--text-primary)]">{questionText}</p>
      <div className="mt-4 flex flex-col gap-2">
        {options.map((opt) => {
          const isWrongPick = showStudentResult && opt.isSelected && !opt.isCorrect;
          const isRightPick = showStudentResult && opt.isSelected && opt.isCorrect;
          return (
            <div
              key={opt.label}
              className={`rounded-lg border px-3 py-2.5 text-sm ${
                opt.isCorrect
                  ? "border-emerald-300 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30"
                  : isWrongPick
                    ? "border-red-300 bg-red-50/80 dark:border-red-800 dark:bg-red-950/30"
                    : isRightPick
                      ? "border-emerald-300 bg-emerald-50/80"
                      : "border-[var(--card-border)]"
              }`}
            >
              <span className="font-semibold text-[var(--text-primary)]">{opt.label} </span>
              <span className="text-[var(--text-secondary)]">{opt.text}</span>
              {opt.isCorrect && (
                <span className="ml-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  (correta)
                </span>
              )}
              {isWrongPick && (
                <span className="ml-2 text-xs font-semibold text-red-600 dark:text-red-400">(marcada)</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProfessorExamReview({
  classGroupId,
  examId,
}: {
  classGroupId: string;
  examId: string;
}) {
  const [tab, setTab] = useState<"gabarito" | "alunos">("gabarito");
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [keyMode, setKeyMode] = useState<"MANUAL" | "RANDOM">("MANUAL");
  const [keyQuestions, setKeyQuestions] = useState<KeyQuestion[]>([]);
  const [keyNote, setKeyNote] = useState<string | null>(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestion[]>([]);
  const [reviewMeta, setReviewMeta] = useState<{
    studentName: string;
    status: string;
    scorePercent: number | null;
    correctCount: number | null;
    totalQuestions: number | null;
  } | null>(null);
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(new Set());
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [examRes, keyRes] = await Promise.all([
      fetch(`/api/teacher/class-groups/${classGroupId}/exams/${examId}`),
      fetch(`/api/teacher/class-groups/${classGroupId}/exams/${examId}/answer-key`),
    ]);
    const examJson = (await examRes.json()) as ApiResponse<{ exam: { attempts: AttemptRow[] } }>;
    const keyJson = (await keyRes.json()) as ApiResponse<{
      mode: "MANUAL" | "RANDOM";
      questions: KeyQuestion[];
      note?: string;
    }>;
    if (examRes.ok && examJson.ok) {
      const list = examJson.data.exam.attempts ?? [];
      setAttempts(list);
      const finished = list.filter((a) => a.status !== "IN_PROGRESS");
      if (finished.length > 0 && !selectedAttemptId) {
        setSelectedAttemptId(finished[0].id);
      }
    }
    if (keyRes.ok && keyJson.ok) {
      setKeyMode(keyJson.data.mode);
      setKeyQuestions(keyJson.data.questions ?? []);
      setKeyNote(keyJson.data.note ?? null);
    }
  }, [classGroupId, examId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadAttemptReview = useCallback(
    async (attemptId: string) => {
      setReviewLoading(true);
      try {
        const res = await fetch(
          `/api/teacher/class-groups/${classGroupId}/exams/${examId}/attempts/${attemptId}`
        );
        const json = (await res.json()) as ApiResponse<{
          attempt: {
            studentName: string;
            status: string;
            scorePercent: number | null;
            correctCount: number | null;
            totalQuestions: number | null;
          };
          questions: ReviewQuestion[];
        }>;
        if (res.ok && json.ok) {
          setReviewMeta(json.data.attempt);
          setReviewQuestions(json.data.questions);
        } else {
          setReviewMeta(null);
          setReviewQuestions([]);
        }
      } finally {
        setReviewLoading(false);
      }
    },
    [classGroupId, examId]
  );

  useEffect(() => {
    if (tab === "alunos" && selectedAttemptId) {
      void loadAttemptReview(selectedAttemptId);
    }
  }, [tab, selectedAttemptId, loadAttemptReview]);

  const finishedAttempts = attempts.filter((a) => a.status !== "IN_PROGRESS");
  const finishedIds = useMemo(() => finishedAttempts.map((a) => a.id), [finishedAttempts]);
  const allExportSelected =
    finishedIds.length > 0 && finishedIds.every((id) => exportSelectedIds.has(id));

  const toggleExportId = (id: string) => {
    setExportSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllExport = () => {
    if (allExportSelected) {
      setExportSelectedIds(new Set());
      return;
    }
    setExportSelectedIds(new Set(finishedIds));
  };

  const downloadPdfBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async (attemptIds: string[]) => {
    setExportError(null);
    setExportLoading(true);
    try {
      const res = await fetch(
        `/api/teacher/class-groups/${classGroupId}/exams/${examId}/export-pdf`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ attemptIds }),
        }
      );
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
        setExportError(json?.ok === false ? json.error.message : "Não foi possível gerar o PDF.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/i.exec(disposition);
      downloadPdfBlob(blob, match?.[1] ?? "provas.pdf");
    } catch {
      setExportError("Erro de rede ao exportar o PDF.");
    } finally {
      setExportLoading(false);
    }
  };

  const exportSelectedPdf = () => {
    const ids = [...exportSelectedIds];
    if (ids.length === 0) {
      setExportError("Selecione ao menos uma prova para exportar.");
      return;
    }
    void exportPdf(ids);
  };

  const exportAllPdf = () => {
    if (finishedIds.length === 0) {
      setExportError("Nenhuma prova finalizada para exportar.");
      return;
    }
    void exportPdf(finishedIds);
  };

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2 border-b border-[var(--card-border)] pb-2">
        <button
          type="button"
          onClick={() => setTab("gabarito")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            tab === "gabarito"
              ? "bg-[var(--igh-primary)] text-white"
              : "bg-[var(--card-bg)] text-[var(--text-secondary)]"
          }`}
        >
          Gabarito
        </button>
        <button
          type="button"
          onClick={() => setTab("alunos")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            tab === "alunos"
              ? "bg-[var(--igh-primary)] text-white"
              : "bg-[var(--card-bg)] text-[var(--text-secondary)]"
          }`}
        >
          Provas dos alunos
        </button>
      </nav>

      {tab === "gabarito" && (
        <div className="flex flex-col gap-4">
          {keyMode === "RANDOM" && keyNote && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40">
              {keyNote}
            </p>
          )}
          {keyQuestions.length === 0 && keyMode === "MANUAL" ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhuma questão no gabarito (rascunho ou sem seleção manual).</p>
          ) : (
            keyQuestions.map((q) => (
              <QuestionBlock
                key={q.order}
                order={q.order}
                questionText={q.questionText}
                lessonTitle={q.lessonTitle}
                options={q.options}
              />
            ))
          )}
        </div>
      )}

      {tab === "alunos" && (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="lg:w-72 lg:shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Alunos</h2>
              {finishedAttempts.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAllExport}
                  className="text-xs font-medium text-[var(--igh-primary)] hover:underline"
                >
                  {allExportSelected ? "Desmarcar todas" : "Selecionar todas"}
                </button>
              )}
            </div>
            {finishedAttempts.length > 0 && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row lg:flex-col">
                <button
                  type="button"
                  disabled={exportLoading || exportSelectedIds.size === 0}
                  onClick={exportSelectedPdf}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--igh-primary)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Exportar selecionadas ({exportSelectedIds.size})
                </button>
                <button
                  type="button"
                  disabled={exportLoading}
                  onClick={exportAllPdf}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--igh-surface)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Exportar todas ({finishedAttempts.length})
                </button>
              </div>
            )}
            {exportError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
                {exportError}
              </p>
            )}
            {finishedAttempts.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhuma prova finalizada ainda.</p>
            ) : (
              <ul className="mt-2 max-h-[480px] space-y-1 overflow-y-auto">
                {finishedAttempts.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <label className="flex shrink-0 items-start pt-3 pl-1">
                      <input
                        type="checkbox"
                        checked={exportSelectedIds.has(a.id)}
                        onChange={() => toggleExportId(a.id)}
                        className="h-4 w-4 rounded border-[var(--card-border)]"
                        aria-label={`Incluir ${a.studentName} na exportação PDF`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedAttemptId(a.id)}
                      className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-left text-sm transition ${
                        selectedAttemptId === a.id
                          ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/10"
                          : "border-[var(--card-border)] hover:bg-[var(--igh-surface)]"
                      }`}
                    >
                      <span className="font-medium text-[var(--text-primary)]">{a.studentName}</span>
                      <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                        {STATUS_PT[a.status] ?? a.status}
                        {a.scorePercent != null ? ` · ${a.scorePercent}%` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {!selectedAttemptId ? (
              <p className="text-sm text-[var(--text-muted)]">Selecione um aluno.</p>
            ) : reviewLoading ? (
              <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
            ) : reviewMeta ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/50 px-4 py-3">
                  <p className="font-semibold text-[var(--text-primary)]">{reviewMeta.studentName}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {STATUS_PT[reviewMeta.status] ?? reviewMeta.status}
                    {reviewMeta.scorePercent != null && (
                      <>
                        {" "}
                        · {reviewMeta.correctCount}/{reviewMeta.totalQuestions} acertos ({reviewMeta.scorePercent}%)
                      </>
                    )}
                  </p>
                </div>
                {reviewQuestions.map((q) => (
                  <QuestionBlock
                    key={q.id}
                    order={q.order}
                    questionText={q.questionText}
                    options={q.options}
                    showStudentResult
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Não foi possível carregar a prova deste aluno.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
