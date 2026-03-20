"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Summary = {
  totalCount: number;
  avgPlatform: number | null;
  avgLessons: number | null;
  avgTeacher: number | null;
};

type Item = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  ratingPlatform: number;
  ratingLessons: number;
  ratingTeacher: number;
  comment: string | null;
  referral: string | null;
  createdAt: string;
};

function fmtAvg(n: number | null) {
  return n == null ? "—" : n.toFixed(1);
}

export function PlatformExperienceEvaluationsClient({
  apiUrl,
  pageTitle,
  pageDescription,
}: {
  apiUrl: string;
  pageTitle: string;
  pageDescription: string;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(apiUrl, { credentials: "include" });
        const json = (await res.json()) as ApiResponse<{ summary: Summary; items: Item[] }>;
        if (!res.ok || !json?.ok) {
          toast.push(
            "error",
            json && !json.ok && "error" in json ? json.error.message : "Falha ao carregar avaliações.",
          );
          return;
        }
        if (!cancelled) {
          setSummary(json.data.summary);
          setItems(json.data.items);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, toast]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{pageTitle}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{pageDescription}</p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Total</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                {summary.totalCount}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Plataforma</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                {fmtAvg(summary.avgPlatform)}
                <span className="text-sm font-normal text-[var(--text-muted)]"> /10</span>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Aulas</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                {fmtAvg(summary.avgLessons)}
                <span className="text-sm font-normal text-[var(--text-muted)]"> /10</span>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Professor</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                {fmtAvg(summary.avgTeacher)}
                <span className="text-sm font-normal text-[var(--text-muted)]"> /10</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Aluno</Th>
                  <Th>E-mail</Th>
                  <Th>Plat.</Th>
                  <Th>Aulas</Th>
                  <Th>Prof.</Th>
                  <Th>Comentário</Th>
                  <Th>Indicação</Th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <Td colSpan={8} className="text-center text-[var(--text-muted)]">
                      Nenhuma avaliação registrada.
                    </Td>
                  </tr>
                ) : (
                  items.map((r) => (
                    <tr key={r.id}>
                      <Td className="whitespace-nowrap text-sm text-[var(--text-muted)]">
                        {new Date(r.createdAt).toLocaleString("pt-BR")}
                      </Td>
                      <Td className="text-sm font-medium text-[var(--text-primary)]">{r.userName}</Td>
                      <Td className="max-w-[10rem] truncate text-sm text-[var(--text-secondary)]">{r.userEmail}</Td>
                      <Td className="tabular-nums text-sm">{r.ratingPlatform}</Td>
                      <Td className="tabular-nums text-sm">{r.ratingLessons}</Td>
                      <Td className="tabular-nums text-sm">{r.ratingTeacher}</Td>
                      <Td className="max-w-[14rem] whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                        {r.comment ?? "—"}
                      </Td>
                      <Td className="max-w-[12rem] whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                        {r.referral ?? "—"}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </>
      ) : null}
    </div>
  );
}
