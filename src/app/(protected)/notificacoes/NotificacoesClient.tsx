"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type Item = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificacoesClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/me/notifications", { credentials: "include", cache: "no-store" })
      .then((r) => r.json() as Promise<ApiResponse<{ items: Item[] }>>)
      .then((json) => {
        if (json?.ok && json.data?.items) setItems(json.data.items);
        else setError("Não foi possível carregar as notificações.");
      })
      .catch(() => setError("Não foi possível carregar as notificações."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markAllRead() {
    await fetch("/api/me/notifications", {
      method: "PATCH",
      credentials: "include",
    });
    load();
  }

  async function markRead(id: string) {
    await fetch(`/api/me/notifications/${id}`, {
      method: "PATCH",
      credentials: "include",
    });
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--text-secondary)]">
          Suporte e relatório à coordenação continuam nos ícones dedicados na barra superior.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={() => void markAllRead()} disabled={loading}>
          Marcar todas como lidas
        </Button>
      </div>
      {loading && <p className="text-sm text-[var(--text-muted)]">Carregando…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">Nenhuma notificação por aqui.</p>
      )}
      <ul className="list-none space-y-2 p-0">
        {items.map((n) => {
          const unread = n.readAt == null;
          return (
            <li key={n.id}>
              <div
                className={`rounded-xl border border-[var(--card-border)] px-4 py-3 ${
                  unread ? "bg-[var(--igh-surface)]" : "bg-[var(--card-bg)] opacity-90"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--text-primary)]">{n.title}</p>
                    {n.body && <p className="mt-1 text-sm text-[var(--text-secondary)]">{n.body}</p>}
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {new Date(n.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {n.linkUrl && (
                      <Link
                        href={n.linkUrl}
                        className="text-sm font-medium text-[var(--igh-primary)] hover:underline"
                        onClick={() => void markRead(n.id)}
                      >
                        Abrir
                      </Link>
                    )}
                    {unread && (
                      <button
                        type="button"
                        className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:underline"
                        onClick={() => void markRead(n.id)}
                      >
                        Marcar lida
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
