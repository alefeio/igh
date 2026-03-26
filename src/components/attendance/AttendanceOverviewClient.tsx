"use client";

import { useCallback, useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import { AttendanceOverviewChart } from "./AttendanceOverviewChart";

export type AttendanceClassGroupSummary = {
  classGroupId: string;
  courseId: string;
  courseName: string;
  turmaLabel: string;
  horarioLabel: string;
  teacherName: string;
  sessionCount: number;
  presentSum: number;
  absentSum: number;
  justifiedAbsentSum: number;
};

type ClassGroupOption = { id: string; label: string };

export function AttendanceOverviewClient({
  apiUrl,
  classGroupsApiUrl,
  exportPdfUrl,
  pageTitle,
  pageDescription,
}: {
  apiUrl: string;
  classGroupsApiUrl: string;
  /** GET que devolve application/pdf */
  exportPdfUrl?: string;
  pageTitle: string;
  pageDescription: string;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [groups, setGroups] = useState<AttendanceClassGroupSummary[]>([]);
  const [totals, setTotals] = useState({
    presentSum: 0,
    absentSum: 0,
    justifiedAbsentSum: 0,
    sessionCount: 0,
    classGroupCount: 0,
  });
  const [classGroups, setClassGroups] = useState<ClassGroupOption[]>([]);
  const [filterGroupId, setFilterGroupId] = useState("");

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch(classGroupsApiUrl, { credentials: "include" });
      const json = (await res.json()) as ApiResponse<{ classGroups: unknown[] }>;
      if (!res.ok || !json?.ok || !json.data?.classGroups) return;
      const raw = json.data.classGroups as Array<{
        id: string;
        course?: { name?: string };
        courseName?: string;
      }>;
      const opts: ClassGroupOption[] = raw.map((cg) => ({
        id: cg.id,
        label: cg.course?.name ?? cg.courseName ?? cg.id,
      }));
      setClassGroups(opts.sort((a, b) => a.label.localeCompare(b.label, "pt-BR")));
    } catch {
      /* ignore */
    }
  }, [classGroupsApiUrl]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filterGroupId ? `?classGroupId=${encodeURIComponent(filterGroupId)}` : "";
      const res = await fetch(`${apiUrl}${q}`, { credentials: "include" });
      const json = (await res.json()) as ApiResponse<{
        groups: AttendanceClassGroupSummary[];
        totals: {
          presentSum: number;
          absentSum: number;
          justifiedAbsentSum: number;
          sessionCount: number;
          classGroupCount: number;
        };
      }>;
      if (!res.ok || !json?.ok) {
        toast.push(
          "error",
          json && !json.ok && "error" in json ? json.error.message : "Falha ao carregar frequência.",
        );
        return;
      }
      setGroups(json.data.groups);
      setTotals(
        json.data.totals ?? {
          presentSum: 0,
          absentSum: 0,
          justifiedAbsentSum: 0,
          sessionCount: 0,
          classGroupCount: 0,
        },
      );
    } finally {
      setLoading(false);
    }
  }, [apiUrl, filterGroupId, toast]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleExportPdf() {
    if (!exportPdfUrl) return;
    setExportingPdf(true);
    try {
      const q = filterGroupId ? `?classGroupId=${encodeURIComponent(filterGroupId)}` : "";
      const res = await fetch(`${exportPdfUrl}${q}`, { credentials: "include" });
      if (!res.ok) {
        toast.push("error", "Não foi possível gerar o PDF.");
        return;
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition");
      let filename = "frequencia.pdf";
      const m = dispo?.match(/filename="([^"]+)"/);
      if (m?.[1]) filename = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.push("error", "Falha ao exportar PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{pageTitle}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{pageDescription}</p>
        </div>
        {exportPdfUrl ? (
          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={exportingPdf}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--igh-primary)]/10 disabled:opacity-60 sm:w-auto"
          >
            <FileDown className="h-4 w-4 shrink-0" aria-hidden />
            {exportingPdf ? "Gerando PDF…" : "Exportar PDF"}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem]">
          <label htmlFor="freq-filter-turma" className="block text-xs font-medium text-[var(--text-muted)]">
            Turma
          </label>
          <select
            id="freq-filter-turma"
            value={filterGroupId}
            onChange={(e) => setFilterGroupId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="">Todas</option>
            {classGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Aulas</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                {totals.sessionCount}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Presenças (soma)
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {totals.presentSum}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Ausências (soma)
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                {totals.absentSum}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Justif. ausência (soma)
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {totals.justifiedAbsentSum}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Turmas</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                {totals.classGroupCount}
              </div>
            </div>
          </div>

          <AttendanceOverviewChart groups={groups} />

          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
            <Table>
              <thead>
                <tr>
                  <Th>Curso</Th>
                  <Th>Turma</Th>
                  <Th>Horário</Th>
                  <Th>Professor</Th>
                  <Th>Presenças / ausências</Th>
                  <Th>Ausências justificadas</Th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr>
                    <Td colSpan={6} className="text-center text-[var(--text-muted)]">
                      Nenhuma turma encontrada no filtro.
                    </Td>
                  </tr>
                ) : (
                  groups.map((r) => (
                    <tr key={r.classGroupId}>
                      <Td className="min-w-[10rem] max-w-[min(28rem,100%)] whitespace-normal break-words text-sm text-[var(--text-primary)]">
                        {r.courseName}
                      </Td>
                      <Td className="max-w-[10rem] text-sm text-[var(--text-secondary)]">{r.turmaLabel}</Td>
                      <Td className="whitespace-nowrap text-sm text-[var(--text-primary)]">{r.horarioLabel}</Td>
                      <Td className="max-w-[10rem] text-sm">{r.teacherName}</Td>
                      <Td className="whitespace-nowrap text-sm tabular-nums text-[var(--text-primary)]">
                        {r.presentSum} / {r.absentSum}
                      </Td>
                      <Td className="text-center text-sm tabular-nums text-[var(--text-secondary)]">
                        {r.justifiedAbsentSum}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
