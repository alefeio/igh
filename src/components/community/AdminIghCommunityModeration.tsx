"use client";

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type QueueItem = {
  id: string;
  title?: string;
  topicTitle?: string;
  topicId?: string;
  content: string;
  kindLabel?: string;
  authorName: string;
  createdAt: string;
};

export function AdminIghCommunityModeration() {
  const toast = useToast();
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [loading, setLoading] = useState(true);
  const [pendingTopics, setPendingTopics] = useState(0);
  const [pendingReplies, setPendingReplies] = useState(0);
  const [topics, setTopics] = useState<QueueItem[]>([]);
  const [replies, setReplies] = useState<QueueItem[]>([]);
  const [editContent, setEditContent] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/igh-community/queue?status=${status}`);
      const json = (await res.json()) as ApiResponse<{
        pendingTopics: number;
        pendingReplies: number;
        topics: QueueItem[];
        replies: (QueueItem & { topicId: string; topicTitle: string })[];
      }>;
      if (res.ok && json.ok) {
        setPendingTopics(json.data.pendingTopics);
        setPendingReplies(json.data.pendingReplies);
        setTopics(json.data.topics);
        setReplies(json.data.replies);
        const edits: Record<string, string> = {};
        json.data.topics.forEach((t) => {
          edits[`topic-${t.id}`] = t.content;
        });
        json.data.replies.forEach((r) => {
          edits[`reply-${r.id}`] = r.content;
        });
        setEditContent(edits);
      }
    } catch {
      toast.push("error", "Falha ao carregar fila.");
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const moderate = async (
    type: "topic" | "reply",
    id: string,
    action: "approve" | "reject"
  ) => {
    setActingId(id);
    try {
      const url =
        type === "topic"
          ? `/api/admin/igh-community/topics/${id}/moderate`
          : `/api/admin/igh-community/replies/${id}/moderate`;
      const contentKey = `${type}-${id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          content: editContent[contentKey],
        }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (res.ok && json.ok) {
        toast.push("success", action === "approve" ? "Publicado." : "Rejeitado.");
        void load();
      } else {
        toast.push("error", json.ok ? "Falha." : json.error.message);
      }
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--text-secondary)]">
        Pendentes: <strong>{pendingTopics}</strong> tópicos · <strong>{pendingReplies}</strong> respostas
      </p>

      <div className="flex flex-wrap gap-2">
        {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              status === s
                ? "bg-[var(--igh-primary)] text-white"
                : "border border-[var(--card-border)] bg-[var(--card-bg)]"
            }`}
          >
            {s === "PENDING" ? "Pendentes" : s === "APPROVED" ? "Publicados" : s === "REJECTED" ? "Rejeitados" : "Todos"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : (
        <>
          <section>
            <h2 className="text-sm font-semibold">Tópicos</h2>
            {topics.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum tópico neste filtro.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {topics.map((t) => (
                  <li key={t.id} className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                    <p className="text-xs text-[var(--text-muted)]">
                      {t.kindLabel} · {t.authorName} · {new Date(t.createdAt).toLocaleString("pt-BR")}
                    </p>
                    <h3 className="mt-1 font-semibold">{t.title}</h3>
                    <textarea
                      className="mt-2 min-h-[80px] w-full rounded-md border border-[var(--card-border)] px-3 py-2 text-sm"
                      value={editContent[`topic-${t.id}`] ?? t.content}
                      onChange={(e) =>
                        setEditContent((prev) => ({ ...prev, [`topic-${t.id}`]: e.target.value }))
                      }
                    />
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={actingId === t.id}
                        onClick={() => void moderate("topic", t.id, "approve")}
                      >
                        Aprovar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={actingId === t.id}
                        onClick={() => void moderate("topic", t.id, "reject")}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold">Respostas</h2>
            {replies.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhuma resposta neste filtro.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {replies.map((r) => (
                  <li key={r.id} className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                    <p className="text-xs text-[var(--text-muted)]">
                      Em: {r.topicTitle} · {r.authorName} · {new Date(r.createdAt).toLocaleString("pt-BR")}
                    </p>
                    <textarea
                      className="mt-2 min-h-[60px] w-full rounded-md border border-[var(--card-border)] px-3 py-2 text-sm"
                      value={editContent[`reply-${r.id}`] ?? r.content}
                      onChange={(e) =>
                        setEditContent((prev) => ({ ...prev, [`reply-${r.id}`]: e.target.value }))
                      }
                    />
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={actingId === r.id}
                        onClick={() => void moderate("reply", r.id, "approve")}
                      >
                        Aprovar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={actingId === r.id}
                        onClick={() => void moderate("reply", r.id, "reject")}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
