"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";
import type { CommunityReplyView, CommunityTopicView } from "@/lib/igh-community-types";

export function IghCommunityTopicDetail({ topicId }: { topicId: string }) {
  const toast = useToast();
  const user = useUser();
  const isStudent = user.role === "STUDENT";
  const canReplyAsStaff = ["MASTER", "ADMIN", "COORDINATOR", "TEACHER"].includes(user.role);

  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState<CommunityTopicView | null>(null);
  const [replies, setReplies] = useState<CommunityReplyView[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [savingReply, setSavingReply] = useState(false);

  const detailUrl = isStudent
    ? `/api/me/igh-community/topics/${topicId}`
    : `/api/igh-community/topics/${topicId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(detailUrl);
      const json = (await res.json()) as ApiResponse<{
        topic: CommunityTopicView;
        replies: CommunityReplyView[];
      }>;
      if (res.ok && json.ok) {
        setTopic(json.data.topic);
        setReplies(json.data.replies);
      } else {
        setTopic(null);
        toast.push("error", json.ok ? "Erro." : json.error.message);
      }
    } catch {
      toast.push("error", "Não foi possível carregar o tópico.");
    } finally {
      setLoading(false);
    }
  }, [detailUrl, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitReply = async () => {
    if (!replyContent.trim()) return;
    setSavingReply(true);
    try {
      const url = isStudent
        ? `/api/me/igh-community/topics/${topicId}/replies`
        : `/api/igh-community/topics/${topicId}/replies`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyContent }),
      });
      const json = (await res.json()) as ApiResponse<{ message?: string }>;
      if (res.ok && json.ok) {
        toast.push("success", json.data.message ?? "Resposta publicada.");
        setReplyContent("");
        setShowReplyForm(false);
        void load();
      } else {
        toast.push("error", json.ok ? "Falha." : json.error.message);
      }
    } finally {
      setSavingReply(false);
    }
  };

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;
  if (!topic) return <p className="text-sm text-[var(--text-muted)]">Tópico não encontrado.</p>;

  const canReply = isStudent || canReplyAsStaff;

  return (
    <div className="flex flex-col gap-6">
      <article className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--igh-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--igh-primary)]">
            {topic.kindLabel}
          </span>
          {topic.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              #{tag}
            </span>
          ))}
        </div>
        <h1 className="mt-3 text-xl font-bold text-[var(--text-primary)]">{topic.title}</h1>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {topic.authorName} · {topic.authorRoleLabel} · {new Date(topic.createdAt).toLocaleString("pt-BR")}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{topic.content}</p>
      </article>

      <section>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Respostas ({replies.length})</h2>
        {replies.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhuma resposta ainda.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {replies.map((r) => (
              <li
                key={r.id}
                className={`rounded-lg border px-4 py-3 ${
                  r.authorRole === "TEACHER" || r.authorRole === "STAFF"
                    ? "border-[var(--igh-primary)]/30 bg-[var(--igh-primary)]/5"
                    : "border-[var(--card-border)] bg-[var(--igh-surface)]/40"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{r.authorName}</span>
                  <span className="rounded-full bg-[var(--igh-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--igh-primary)]">
                    {r.authorRoleLabel}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(r.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{r.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canReply && !showReplyForm && (
        <Button type="button" onClick={() => setShowReplyForm(true)}>
          {canReplyAsStaff ? "Participar da conversa" : "Responder"}
        </Button>
      )}

      {canReply && showReplyForm && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <h3 className="text-sm font-semibold">
            {canReplyAsStaff ? "Sua resposta como equipe IGH" : "Sua resposta"}
          </h3>
          <textarea
            className="mt-2 min-h-[100px] w-full rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={
              canReplyAsStaff
                ? "Oriente, incentive ou esclareça dúvidas da comunidade…"
                : "Contribua com a discussão…"
            }
          />
          <div className="mt-3 flex gap-2">
            <Button type="button" disabled={savingReply} onClick={() => void submitReply()}>
              {savingReply ? "Enviando…" : "Publicar resposta"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowReplyForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <Link href="/comunidade" className="text-sm font-medium text-[var(--igh-primary)] hover:underline">
        ← Voltar à comunidade
      </Link>
    </div>
  );
}
