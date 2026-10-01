"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { ENROLLMENT_HISTORY_KIND_LABEL, type EnrollmentHistoryKindValue } from "@/lib/enrollment-history";
import { formatDateTime } from "@/lib/format";
import type { ApiResponse } from "@/lib/api-types";

type HistoryItem = {
  id: string;
  kind: EnrollmentHistoryKindValue;
  body: string;
  createdAt: string;
  authorName: string;
};

type EnrollmentRow = {
  id: string;
  statusLabel: string;
  studentName: string;
  courseName: string;
  teacherName: string;
  history: HistoryItem[];
};

type Payload = {
  cycle: { id: string; label: string } | null;
  enrollments: EnrollmentRow[];
};

export function CoordenacaoBuscaAtiva() {
  const toast = useToast();
  const [cycles, setCycles] = useState<{ id: string; label: string }[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCycles = useCallback(async () => {
    const res = await fetch("/api/coordenacao/matriculas", { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<{ cycles: { id: string; label: string }[]; cycle: { id: string } | null }>;
    if (res.ok && json.ok) {
      setCycles(json.data.cycles.map((cycle) => ({ id: cycle.id, label: cycle.label })));
      if (json.data.cycle) setCycleId(json.data.cycle.id);
    }
  }, []);

  const loadRows = useCallback(async (id: string, q: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ cycleId: id, q, somenteHistorico: q ? "0" : "1" });
      const res = await fetch(`/api/coordenacao/busca-ativa?${params}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (res.ok && json.ok) setRows(json.data.enrollments);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCycles();
  }, [loadCycles]);

  useEffect(() => {
    if (cycleId) void loadRows(cycleId, query);
  }, [cycleId, loadRows, query]);

  async function addNote(enrollmentId: string) {
    const text = (drafts[enrollmentId] ?? "").trim();
    if (text.length < 2) {
      toast.push("error", "Escreva a informação da busca ativa.");
      return;
    }
    setSavingId(enrollmentId);
    try {
      const res = await fetch("/api/coordenacao/busca-ativa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, body: text }),
      });
      const json = (await res.json()) as ApiResponse<{ entry: HistoryItem }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Não foi possível registrar.");
        return;
      }
      setDrafts((prev) => ({ ...prev, [enrollmentId]: "" }));
      setRows((prev) =>
        prev.map((row) =>
          row.id === enrollmentId ? { ...row, history: [json.data.entry, ...row.history] } : row,
        ),
      );
      toast.push("success", "Informação registrada no histórico.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardHero
        eyebrow="Coordenação"
        title="Busca ativa"
        description="Histórico registrado pelos professores e novas anotações da coordenação ou da direção."
      />
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-[12rem] flex-col gap-1 text-sm text-[var(--text-secondary)]">
          Ciclo
          <select
            className="h-10 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3"
            value={cycleId}
            onChange={(event) => setCycleId(event.target.value)}
          >
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-sm text-[var(--text-secondary)]">
          Buscar aluno, curso ou professor
          <input
            className="theme-input h-10 rounded-md border px-3"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome do aluno, curso ou professor"
          />
        </label>
      </div>
      {loading ? <p className="text-sm text-[var(--text-muted)]">Carregando…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          {query
            ? "Nenhuma matrícula encontrada nesse ciclo."
            : "Nenhum histórico neste ciclo. Busque um aluno para registrar a primeira informação."}
        </p>
      ) : null}
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <SectionCard
            key={row.id}
            title={row.studentName}
            description={`${row.courseName} · Professor ${row.teacherName} · ${row.statusLabel}`}
            variant="elevated"
          >
            <ul className="flex flex-col gap-3">
              {row.history.length === 0 ? (
                <li className="text-sm text-[var(--text-muted)]">Nenhum registro ainda.</li>
              ) : (
                row.history.map((entry) => (
                  <li key={entry.id} className="rounded-md border border-[var(--card-border)] px-3 py-2">
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatDateTime(entry.createdAt)} · {ENROLLMENT_HISTORY_KIND_LABEL[entry.kind] ?? entry.kind} ·{" "}
                      Registrado por {entry.authorName}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{entry.body}</p>
                  </li>
                ))
              )}
            </ul>
            <div className="mt-4 flex flex-col gap-2">
              <textarea
                className="theme-input min-h-[88px] w-full rounded-md border px-3 py-2 text-sm"
                maxLength={2000}
                placeholder="Nova informação de busca ativa"
                value={drafts[row.id] ?? ""}
                onChange={(event) => setDrafts((prev) => ({ ...prev, [row.id]: event.target.value }))}
              />
              <div className="flex justify-end">
                <Button type="button" size="sm" disabled={savingId === row.id} onClick={() => void addNote(row.id)}>
                  {savingId === row.id ? "Salvando…" : "Registrar"}
                </Button>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
