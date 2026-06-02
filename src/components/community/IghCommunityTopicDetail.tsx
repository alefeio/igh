"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";
import type { CommunityTopicView } from "@/lib/igh-community-types";

type ReplyView = {
  id: string;
  content: string;
  status: string;
  statusLabel: string;
  authorName: string;
  isOwn: boolean;
  createdAt: string;
};

function statusBadgeClass(status: string) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (status === "PENDING") return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
  return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300";
}

export function IghCommunityTopicDetail({ topicId }: { topicId: string }) {
  const toast = useToast();
  const user = useUser();
  const isStudent = user.role === "STUDENT";

  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState<CommunityTopicView | null>(null);
  const [replies, setReplies] = useState<ReplyView[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [savingReply, setSavingReply] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = isStudent
        ? `/api/me/igh-community/topics/${topicId}`
        : `/api/igh-community/topics/${topicId}`;
      const res = await fetch(url);
      const json = (await res.json()) as ApiResponse<{
        topic: CommunityTopicView;
        replies: ReplyView[];
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
  }, [topicId, isStudent, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitReply = async () => {
    if (!replyContent.trim() || !isStudent) return;
    setSavingReply(true);
    try {
      const res = await fetch(`/api/me/igh-community/topics/${topicId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyContent }),
      });
      const json = (await res.json()) as ApiResponse<{ message?: string }>;
      if (res.ok && json.ok) {
        toast.push("success", json.data.message ?? "Resposta enviada.");
        setReplyContent("");
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

  const canReply = isStudent && topic.status === "APPROVED";

  return (
    <div className="flex flex-col gap-6">
      <article className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--igh-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--igh-primary)]">
            {topic.kindLabel}
          </span>
          {(topic.isOwn || topic.status !== "APPROVED") && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(topic.status)}`}>
              {topic.statusLabel}
            </span>
          )}
        </div>
        <h1 className="mt-3 text-xl font-bold text-[var(--text-primary)]">{topic.title}</h1>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {topic.authorName} · {new Date(topic.createdAt).toLocaleString("pt-BR")}
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
              <li key={r.id} className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/40 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{r.authorName}</span>
                  {r.status !== "APPROVED" && (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(r.status)}`}>
                      {r.statusLabel}
                    </span>
                  )}
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

      {canReply && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <h3 className="text-sm font-semibold">Sua resposta</h3>
          <textarea
            className="mt-2 min-h-[100px] w-full rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Contribua com a discussão…"
          />
          <Button type="button" className="mt-3" disabled={savingReply} onClick={() => void submitReply()}>
            {savingReply ? "Enviando…" : "Enviar resposta (moderação)"}
          </Button>
        </div>
      )}

      <Link href="/comunidade" className="text-sm font-medium text-[var(--igh-primary)] hover:underline">
        ← Voltar à comunidade
      </Link>
    </div>
  );
}
