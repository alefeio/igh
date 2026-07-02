"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import type { ApiResponse } from "@/lib/api-types";
import {
  TEACHER_CLASS_GROUP_TABS,
  TEACHER_CLASS_GROUP_TAB_LABELS,
  type TeacherClassGroupTab,
} from "@/lib/teacher-class-group-tabs";

const STATUS_LABELS: Record<string, string> = {
  PLANEJADA: "Planejada",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
  INTERNO: "Interno",
  EXTERNO: "Externo",
};

type ClassGroupRow = {
  id: string;
  courseName: string;
  startDate: string;
  startTime: string;
  endTime: string;
  status: string;
  capacity: number;
  location: string | null;
  enrollmentsCount: number;
};

function formatDate(s: string) {
  const d = new Date(s);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function ProfessorTurmasTabs() {
  const [activeTab, setActiveTab] = useState<TeacherClassGroupTab>("em_andamento");
  const [cache, setCache] = useState<Partial<Record<TeacherClassGroupTab, ClassGroupRow[]>>>({});
  const [loadingTab, setLoadingTab] = useState<TeacherClassGroupTab | null>("em_andamento");
  const [error, setError] = useState<string | null>(null);

  const loadTab = useCallback(async (tab: TeacherClassGroupTab) => {
    setLoadingTab(tab);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/class-groups?tab=${tab}`);
      const json = (await res.json()) as ApiResponse<{ classGroups: ClassGroupRow[] }>;
      if (!res.ok || !json?.ok) {
        const msg =
          json && "error" in json
            ? ((json.error as { message?: string }).message ?? "Erro ao carregar turmas.")
            : "Erro ao carregar turmas.";
        setError(msg);
        return;
      }
      setCache((prev) => ({ ...prev, [tab]: json.data.classGroups ?? [] }));
    } finally {
      setLoadingTab((current) => (current === tab ? null : current));
    }
  }, []);

  useEffect(() => {
    void loadTab("em_andamento");
  }, [loadTab]);

  const handleTabChange = (tab: TeacherClassGroupTab) => {
    setActiveTab(tab);
    if (cache[tab] === undefined) {
      void loadTab(tab);
    }
  };

  const rows = cache[activeTab];
  const isLoading = loadingTab === activeTab && rows === undefined;

  return (
    <SectionCard
      title="Suas turmas"
      description={
        rows !== undefined
          ? rows.length === 0
            ? `Nenhuma turma ${TEACHER_CLASS_GROUP_TAB_LABELS[activeTab].toLowerCase()}.`
            : `${rows.length} ${rows.length === 1 ? "turma" : "turmas"}.`
          : "Carregando..."
      }
      variant="elevated"
    >
      <div className="mb-4 flex flex-wrap gap-2 border-b border-[var(--card-border)] pb-3">
        {TEACHER_CLASS_GROUP_TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--igh-primary)] text-white"
                  : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
              }`}
            >
              {TEACHER_CLASS_GROUP_TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-6 py-12 text-center text-[var(--text-muted)]">
          Carregando turmas...
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-6 py-12 text-center text-[var(--text-muted)]">
          Nenhuma turma nesta categoria.
        </div>
      ) : rows && rows.length > 0 ? (
        <TableShell>
          <thead>
            <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]">
              <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Curso</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Status</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Início</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Horário</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Local</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Alunos</th>
              <th className="px-3 py-2 text-right font-medium text-[var(--text-primary)]">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cg) => (
              <tr key={cg.id} className="border-b border-[var(--card-border)] last:border-b-0">
                <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                  <Link
                    href={`/professor/turmas/${cg.id}`}
                    className="text-[var(--igh-primary)] hover:underline"
                  >
                    {cg.courseName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">
                  {STATUS_LABELS[cg.status] ?? cg.status}
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{formatDate(cg.startDate)}</td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">
                  {cg.startTime} – {cg.endTime}
                </td>
                <td
                  className="max-w-[200px] truncate px-3 py-2 text-[var(--text-secondary)]"
                  title={cg.location ?? undefined}
                >
                  {cg.location?.trim() ? cg.location : "—"}
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">
                  {cg.enrollmentsCount} / {cg.capacity}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/professor/turmas/${cg.id}`}
                    className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1.5 text-sm font-medium text-[var(--igh-primary)] hover:bg-[var(--igh-surface)]"
                  >
                    Ver turma
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      ) : null}
    </SectionCard>
  );
}
