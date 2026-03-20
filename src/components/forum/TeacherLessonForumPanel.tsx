"use client";

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type LessonQuestionReply = {
  id: string;
  content: string;
  createdAt: string;
  enrollmentId: string;
  authorName: string;
};
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

type TopicsPayload = {
  lessonTitle: string;
  moduleTitle: string;
  topics: LessonQuestion[];
};

function formatForumDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TeacherLessonForumPanel({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<Pick<TopicsPayload, "lessonTitle" | "moduleTitle"> | null>(null);
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [replyByQuestion, setReplyByQuestion] = useState<Record<string, string>>({});
  const [savingForQuestion, setSavingForQuestion] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/course-forum/${courseId}/lessons/${lessonId}/topics`);
      const json = (await res.json()) as ApiResponse<TopicsPayload>;
      if (res.ok && json?.ok) {
        setMeta({ lessonTitle: json.data.lessonTitle, moduleTitle: json.data.moduleTitle });
        setQuestions(json.data.topics);
      } else {
        setMeta(null);
        setQuestions([]);
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível carregar o fórum.");
      }
    } catch {
      setMeta(null);
      setQuestions([]);
      toast.push("error", "Não foi possível carregar o fórum.");
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId, toast]);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  const sendTeacherReply = async (questionId: string) => {
    const content = (replyByQuestion[questionId] ?? "").trim();
    if (content.length < 2) {
      toast.push("error", "Digite a resposta.");
      return;
    }
    setSavingForQuestion(questionId);
    try {
      const res = await fetch(`/api/teacher/course-forum/${courseId}/questions/${questionId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = (await res.json()) as ApiResponse<LessonTeacherReply>;
      if (res.ok && json?.ok) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId
              ? { ...q, teacherReplies: [...(q.teacherReplies ?? []), json.data!] }
              : q
          )
        );
        setReplyByQuestion((p) => ({ ...p, [questionId]: "" }));
        toast.push("success", "Resposta publicada para todo o curso.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível enviar.");
      }
    } finally {
      setSavingForQuestion(null);
    }
  };

  if (loading && !meta) {
    return <p className="text-sm text-[var(--text-muted)]">Carregando discussões…</p>;
  }

  if (!meta) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm text-[var(--text-secondary)]">
        <p className="font-semibold text-[var(--text-primary)]">Fórum por curso (todas as suas turmas)</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Os tópicos reúnem alunos de <strong>todas as turmas</strong> deste curso. Respostas suas aparecem para todos — use para
          orientar, elogiar a participação e estimular quem ajuda os colegas.
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">
          Tópicos ({questions.length})
        </h2>
        {questions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhuma discussão nesta aula ainda.</p>
        ) : (
          <ul className="space-y-4">
            {questions.map((q) => (
              <li key={q.id} className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-sm">
                <div className="mb-2 flex flex-wrap items-baseline gap-2 text-xs text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--text-primary)]">{q.authorName}</span>
                  <span>{formatForumDate(q.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-[var(--text-primary)]">{q.content}</p>

                {(q.teacherReplies ?? []).length > 0 && (
                  <div className="mt-3 rounded-md border border-[var(--igh-primary)]/30 bg-[var(--igh-primary)]/5 p-2">
                    <p className="mb-2 text-xs font-semibold text-[var(--igh-primary)]">Suas respostas e de outros professores</p>
                    {(q.teacherReplies ?? []).map((r) => (
                      <div key={r.id} className="mb-2 text-xs last:mb-0">
                        <span className="font-medium text-[var(--text-primary)]">{r.teacherName}</span>
                        <span className="ml-2 text-[var(--text-muted)]">{formatForumDate(r.createdAt)}</span>
                        <p className="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {(q.replies ?? []).length > 0 && (
                  <div className="mt-3 border-t border-[var(--card-border)] pt-3">
                    <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">Respostas dos alunos</p>
                    {(q.replies ?? []).map((r) => (
                      <div key={r.id} className="mb-2 text-xs">
                        <span className="font-medium text-[var(--text-secondary)]">{r.authorName}</span>
                        <span className="ml-2 text-[var(--text-muted)]">{formatForumDate(r.createdAt)}</span>
                        <p className="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-dashed border-[var(--card-border)] pt-3">
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Responder como professor</label>
                  <textarea
                    value={replyByQuestion[q.id] ?? ""}
                    onChange={(e) => setReplyByQuestion((p) => ({ ...p, [q.id]: e.target.value }))}
                    rows={2}
                    placeholder="Dica, correção ou reconhecimento ao engajamento da turma…"
                    className="mb-2 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => sendTeacherReply(q.id)}
                    disabled={savingForQuestion === q.id || !(replyByQuestion[q.id] ?? "").trim()}
                    className="rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {savingForQuestion === q.id ? "Enviando…" : "Publicar resposta"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
