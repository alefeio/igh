"use client";

import { useEffect, useState } from "react";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type RatingItem = {
  id: string;
  score: number;
  emoji: string;
  label: string;
  channelLabel: string;
  comment: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  userName: string | null;
  createdAt: string;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Belem" });
}

export default function AvaliacoesAtendimentoPage() {
  const [items, setItems] = useState<RatingItem[]>([]);
  const [summary, setSummary] = useState<{ count: number; average: number | null }>({ count: 0, average: null });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/site/avaliacoes-atendimento");
        const json = (await res.json()) as ApiResponse<{
          summary: { count: number; average: number | null };
          items: RatingItem[];
        }>;
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error.message);
          return;
        }
        setSummary(json.data.summary);
        setItems(json.data.items);
      } catch {
        if (!cancelled) setError("Não foi possível carregar as avaliações.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Avaliações de atendimento</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {summary.count === 0
            ? "Nenhuma avaliação ainda."
            : `${summary.count} avaliação${summary.count === 1 ? "" : "ões"} · média ${summary.average?.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`}
        </p>
      </div>
      {loading ? <p className="text-sm text-[var(--text-muted)]">Carregando…</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {!loading && !error && items.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Quando</Th>
              <Th>Nota</Th>
              <Th>Canal</Th>
              <Th>Pessoa</Th>
              <Th>Comentário</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{formatDateTime(item.createdAt)}</Td>
                <Td>
                  <span title={item.label}>
                    {item.emoji} {item.score}
                  </span>
                </Td>
                <Td>{item.channelLabel}</Td>
                <Td>
                  <div className="text-sm">
                    {item.name || item.userName || "Sem nome"}
                    {item.userName && item.name ? (
                      <span className="block text-xs text-[var(--text-muted)]">Conta: {item.userName}</span>
                    ) : null}
                    {item.email ? <span className="block text-xs text-[var(--text-muted)]">{item.email}</span> : null}
                    {item.phone ? <span className="block text-xs text-[var(--text-muted)]">{item.phone}</span> : null}
                  </div>
                </Td>
                <Td>{item.comment || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </div>
  );
}
