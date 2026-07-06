"use client";

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

type QueueItem = {
  id: string;
  title?: string;
  topicTitle?: string;
  topicId?: string;
  content: string;
  kindLabel?: string;
  authorName: string;
  authorRoleLabel: string;
  tags?: string[];
  createdAt: string;
};

export function AdminIghCommunityModeration() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<QueueItem[]>([]);
  const [replies, setReplies] = useState<QueueItem[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const res = await fetch(`/api/admin/igh-community/queue${q}`);
      const json = (await res.json()) as ApiResponse<{
        topics: QueueItem[];
        replies: (QueueItem & { topicId: string; topicTitle: string })[];
      }>;
      if (res.ok && json.ok) {
        setTopics(json.data.topics);
        setReplies(json.data.replies);
      }
    } catch {
      toast.push("error", "Falha ao carregar publicações.");
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (type: "topic" | "reply", id: string) => {
    if (!confirm(type === "topic" ? "Excluir este tópico e todas as respostas?" : "Excluir este comentário?")) {
      return;
    }
    setActingId(id);
    try {
      const url =
        type === "topic"
          ? `/api/admin/igh-community/topics/${id}`
          : `/api/admin/igh-community/replies/${id}`;
      const res = await fetch(url, { method: "DELETE" });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (res.ok && json.ok) {
        toast.push("success", "Removido.");
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
        As publicações aparecem imediatamente na comunidade. Use esta tela para <strong>excluir</strong> tópicos ou
        comentários inadequados a qualquer momento.
      </p>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <Input
          className="min-w-[220px] flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título ou conteúdo…"
        />
        <Button type="submit">Buscar</Button>
      </form>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : (
        <>
          <section>
            <h2 className="text-sm font-semibold">Tópicos ({topics.length})</h2>
            {topics.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum tópico encontrado.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {topics.map((t) => (
                  <li key={t.id} className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                    <p className="text-xs text-[var(--text-muted)]">
                      {t.kindLabel} · {t.authorName} ({t.authorRoleLabel}) ·{" "}
                      {new Date(t.createdAt).toLocaleString("pt-BR")}
                    </p>
                    {t.tags && t.tags.length > 0 && (
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {t.tags.map((tag) => `#${tag}`).join(" ")}
                      </p>
                    )}
                    <h3 className="mt-1 font-semibold">{t.title}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{t.content}</p>
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={actingId === t.id}
                        onClick={() => void remove("topic", t.id)}
                      >
                        Excluir tópico
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold">Comentários ({replies.length})</h2>
            {replies.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum comentário encontrado.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {replies.map((r) => (
                  <li key={r.id} className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                    <p className="text-xs text-[var(--text-muted)]">
                      Em: {r.topicTitle} · {r.authorName} ({r.authorRoleLabel}) ·{" "}
                      {new Date(r.createdAt).toLocaleString("pt-BR")}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{r.content}</p>
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={actingId === r.id}
                        onClick={() => void remove("reply", r.id)}
                      >
                        Excluir comentário
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
