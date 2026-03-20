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
  primaryEnrollmentId: string;
  canParticipate: boolean;
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

export function StudentLessonForumPanel({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<Pick<TopicsPayload, "lessonTitle" | "moduleTitle" | "primaryEnrollmentId" | "canParticipate"> | null>(
    null
  );
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

  const enrollmentId = meta?.primaryEnrollmentId ?? "";
  const canParticipate = meta?.canParticipate ?? false;

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/me/course-forum/${courseId}/lessons/${lessonId}/topics`);
      const json = (await res.json()) as ApiResponse<TopicsPayload>;
      if (res.ok && json?.ok) {
        setMeta({
          lessonTitle: json.data.lessonTitle,
          moduleTitle: json.data.moduleTitle,
          primaryEnrollmentId: json.data.primaryEnrollmentId,
          canParticipate: json.data.canParticipate,
        });
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

  const handleSendQuestion = async () => {
    const content = questionContent.trim();
    if (!content) {
      toast.push("error", "Digite sua mensagem.");
      return;
    }
    if (!enrollmentId) return;
    setSavingQuestion(true);
    try {
      const res = await fetch(`/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = (await res.json()) as ApiResponse<LessonQuestion>;
      if (res.ok && json?.ok) {
        setQuestions((prev) => [...prev, json.data]);
        setQuestionContent("");
        toast.push("success", "Publicado! Colegas e professores podem ver e responder.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível enviar.");
      }
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Excluir este tópico?")) return;
    if (!enrollmentId) return;
    setRemovingQuestionId(questionId);
    try {
      const res = await fetch(
        `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}/questions/${questionId}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
      if (res.ok && json?.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
        toast.push("success", "Tópico removido.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível excluir.");
      }
    } finally {
      setRemovingQuestionId(null);
    }
  };

  const handleSaveEditQuestion = async () => {
    if (!editingQuestionId || !enrollmentId) return;
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
          prev.map((q) =>
            q.id === editingQuestionId
              ? { ...q, content: json.data!.content, updatedAt: json.data!.updatedAt }
              : q
          )
        );
        setEditingQuestionId(null);
        setEditQuestionContent("");
        toast.push("success", "Atualizado.");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível atualizar.");
      }
    } finally {
      setSavingEditQuestionId(null);
    }
  };

  const handleSendReply = async (questionId: string) => {
    const content = replyContent.trim();
    if (!content) {
      toast.push("error", "Digite sua resposta.");
      return;
    }
    if (!enrollmentId) return;
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
            q.id === questionId ? { ...q, replies: [...(q.replies ?? []), json.data!] } : q
          )
        );
        setReplyingToQuestionId(null);
        setReplyContent("");
        toast.push("success", "Resposta enviada — obrigado por ajudar a turma!");
      } else {
        toast.push("error", json && "error" in json ? json.error.message : "Não foi possível enviar.");
      }
    } finally {
      setSavingReplyQuestionId(null);
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
      <div className="rounded-xl border border-[var(--igh-primary)]/20 bg-gradient-to-br from-[var(--igh-primary)]/8 to-violet-500/5 px-4 py-3 text-sm text-[var(--text-secondary)]">
        <p className="font-semibold text-[var(--text-primary)]">Fórum desta aula — visão do curso inteiro</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          As mensagens aparecem para <strong>todos os alunos matriculados neste curso</strong>, em qualquer turma. Troque ideias,
          tire dúvidas e incentive quem está estudando com você. O professor também pode participar.
        </p>
      </div>

      {!canParticipate && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Esta aula ainda não está liberada no cronograma da sua turma. Você pode <strong>ler</strong> o que a turma já discutiu;
          para publicar ou responder, aguarde a liberação da aula em &quot;Minhas turmas&quot;.
        </div>
      )}

      {canParticipate && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">Novo tópico</h2>
          <p className="mb-2 text-xs text-[var(--text-muted)]">
            Pergunte, compartilhe um insight ou elogie a participação de alguém — pequenos gestos mantêm o fórum vivo.
          </p>
          <div className="flex flex-col gap-2">
            <textarea
              value={questionContent}
              onChange={(e) => setQuestionContent(e.target.value)}
              placeholder="Ex.: Alguém mais teve dúvida no exercício 3? Vamos trocar ideias…"
              rows={3}
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            <button
              type="button"
              onClick={handleSendQuestion}
              disabled={savingQuestion || !questionContent.trim()}
              className="self-start rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {savingQuestion ? "Publicando…" : "Publicar no fórum"}
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">
          Discussões ({questions.length})
        </h2>
        {questions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            {canParticipate
              ? "Nenhuma mensagem ainda. Abra o primeiro tópico e ajude a criar um ambiente colaborativo."
              : "Ainda não há mensagens nesta aula."}
          </p>
        ) : (
          <ul className="space-y-3">
            {questions.map((q) => (
              <li key={q.id} className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-baseline gap-2 text-xs text-[var(--text-muted)]">
                      <span className="font-medium text-[var(--text-secondary)]">{q.authorName}</span>
                      <span>{formatForumDate(q.createdAt)}</span>
                      {q.updatedAt && q.updatedAt !== q.createdAt && <span className="italic">(editado)</span>}
                    </div>
                    {editingQuestionId === q.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editQuestionContent}
                          onChange={(e) => setEditQuestionContent(e.target.value)}
                          rows={3}
                          className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--igh-primary)]"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSaveEditQuestion}
                            disabled={savingEditQuestionId === q.id || !editQuestionContent.trim()}
                            className="rounded bg-[var(--igh-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                          >
                            {savingEditQuestionId === q.id ? "Salvando…" : "Salvar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQuestionId(null);
                              setEditQuestionContent("");
                            }}
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
                        onClick={() => {
                          setEditingQuestionId(q.id);
                          setEditQuestionContent(q.content);
                        }}
                        className="rounded px-2 py-1 text-xs font-medium text-[var(--igh-primary)] hover:bg-[var(--igh-surface)]"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        disabled={removingQuestionId === q.id}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-60"
                      >
                        {removingQuestionId === q.id ? "Excluindo…" : "Excluir"}
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-3 border-t border-[var(--card-border)] pt-3 pl-3">
                  {(q.teacherReplies ?? []).length > 0 && (
                    <div className="mb-3 rounded-md border border-[var(--igh-primary)]/30 bg-[var(--igh-primary)]/5 p-2">
                      <p className="mb-2 text-xs font-semibold text-[var(--igh-primary)]">Professor(a)</p>
                      {(q.teacherReplies ?? []).map((r) => (
                        <div key={r.id} className="mb-2 text-xs last:mb-0">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-medium text-[var(--text-primary)]">{r.teacherName}</span>
                            <span className="text-[var(--text-muted)]">{formatForumDate(r.createdAt)}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {(q.replies ?? []).length > 0 && (
                    <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
                      Respostas da turma ({(q.replies ?? []).length})
                    </p>
                  )}
                  {(q.replies ?? []).map((r) => (
                    <div key={r.id} className="mb-2 text-xs">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium text-[var(--text-secondary)]">{r.authorName}</span>
                        <span className="text-[var(--text-muted)]">{formatForumDate(r.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">{r.content}</p>
                    </div>
                  ))}
                  {canParticipate &&
                    (replyingToQuestionId === q.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          rows={2}
                          className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                          placeholder="Sua resposta ou incentivo…"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendReply(q.id)}
                            disabled={savingReplyQuestionId === q.id || !replyContent.trim()}
                            className="rounded bg-[var(--igh-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                          >
                            {savingReplyQuestionId === q.id ? "Enviando…" : "Enviar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingToQuestionId(null);
                              setReplyContent("");
                            }}
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
                        onClick={() => {
                          setReplyingToQuestionId(q.id);
                          setReplyContent("");
                        }}
                        className="rounded text-xs font-medium text-[var(--igh-primary)] hover:underline"
                      >
                        Responder ou incentivar
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
