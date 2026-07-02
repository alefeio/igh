"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";
import {
  attendancePercent,
  nextAttendanceMark,
  type AttendanceMark,
} from "@/lib/attendance-mark";

type GridSession = {
  id: string;
  sessionDate: string;
  sessionDateLabel: string;
  lessonNumber: number;
  lessonTitle: string | null;
};

type GridRow = {
  enrollmentId: string;
  studentName: string;
  enrollmentStatus: string;
  cells: Record<string, AttendanceMark | null>;
  presentCount: number;
  recordedCount: number;
  frequencyPercent: number | null;
};

type AttendanceGridProps = {
  classGroupId: string;
  title?: string;
  onEnrollmentChange?: () => void;
};

function cellClass(mark: AttendanceMark | null, saving: boolean): string {
  const base =
    "flex h-9 w-9 items-center justify-center rounded text-xs font-bold tabular-nums transition-colors cursor-pointer select-none";
  if (saving) return `${base} opacity-60`;
  if (mark === "P") return `${base} bg-emerald-200 text-emerald-900 hover:bg-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-100`;
  if (mark === "F") return `${base} bg-rose-200 text-rose-900 hover:bg-rose-300 dark:bg-rose-900/50 dark:text-rose-100`;
  if (mark === "J") return `${base} bg-rose-100 text-rose-800 ring-1 ring-rose-300 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-200`;
  return `${base} border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/50 text-[var(--text-muted)] hover:bg-[var(--igh-surface)]`;
}

function markLabel(mark: AttendanceMark | null): string {
  if (mark === "P") return "P";
  if (mark === "F") return "F";
  if (mark === "J") return "J";
  return "—";
}

export function AttendanceGrid({ classGroupId, title, onEnrollmentChange }: AttendanceGridProps) {
  const toast = useToast();
  const [sessions, setSessions] = useState<GridSession[]>([]);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const loadGrid = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/class-groups/${classGroupId}/attendance-grid`);
      const json = (await res.json()) as ApiResponse<{ sessions: GridSession[]; rows: GridRow[] }>;
      if (res.ok && json?.ok) {
        setSessions(json.data.sessions ?? []);
        setRows(json.data.rows ?? []);
      } else {
        setSessions([]);
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [classGroupId]);

  useEffect(() => {
    void loadGrid();
  }, [loadGrid]);

  const rowIndexByEnrollment = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r, i) => map.set(r.enrollmentId, i));
    return map;
  }, [rows]);

  const recomputeRowStats = (cells: Record<string, AttendanceMark | null>, sessionIds: string[]) => {
    let presentCount = 0;
    let recordedCount = 0;
    for (const sid of sessionIds) {
      const mark = cells[sid] ?? null;
      if (mark) {
        recordedCount += 1;
        if (mark === "P") presentCount += 1;
      }
    }
    return {
      presentCount,
      recordedCount,
      frequencyPercent: recordedCount > 0 ? attendancePercent(presentCount, recordedCount) : null,
    };
  };

  const handleCellClick = async (enrollmentId: string, sessionId: string) => {
    const rowIdx = rowIndexByEnrollment.get(enrollmentId);
    if (rowIdx === undefined) return;

    const row = rows[rowIdx];
    const current = row.cells[sessionId] ?? null;
    const next = nextAttendanceMark(current);
    const key = `${enrollmentId}:${sessionId}`;

    const prevRows = rows;
    const sessionIds = sessions.map((s) => s.id);
    const newCells = { ...row.cells, [sessionId]: next };
    const stats = recomputeRowStats(newCells, sessionIds);

    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIdx ? { ...r, cells: newCells, ...stats } : r
      )
    );
    setSavingKey(key);

    try {
      const res = await fetch(`/api/teacher/class-groups/${classGroupId}/attendance-grid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ sessionId, enrollmentId, mark: next }],
        }),
      });
      const json = (await res.json()) as ApiResponse<{
        suspendedEnrollmentIds?: string[];
        reactivatedEnrollmentIds?: string[];
      }>;

      if (!res.ok || !json?.ok) {
        setRows(prevRows);
        const msg =
          json && "error" in json
            ? ((json.error as { message?: string }).message ?? "Erro ao salvar frequência.")
            : "Erro ao salvar frequência.";
        toast.push("error", msg);
        return;
      }

      const suspended = json.data?.suspendedEnrollmentIds ?? [];
      const reactivated = json.data?.reactivatedEnrollmentIds ?? [];
      if (suspended.length > 0) {
        toast.push(
          "success",
          `${suspended.length} matrícula(s) suspensa(s) por 3 faltas consecutivas sem justificativa.`
        );
        onEnrollmentChange?.();
        void loadGrid();
      } else if (reactivated.length > 0) {
        toast.push("success", `${reactivated.length} matrícula(s) reativada(s) após presença registrada.`);
        onEnrollmentChange?.();
      }
    } catch {
      setRows(prevRows);
      toast.push("error", "Erro ao salvar frequência.");
    } finally {
      setSavingKey((k) => (k === key ? null : k));
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Carregando frequência...</div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
        Nenhuma aula liberada para lançar frequência.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
        Nenhum aluno com matrícula ativa ou suspensa nesta turma.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {title && (
        <p className="text-center text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      )}
      <p className="text-xs text-[var(--text-muted)]">
        Clique em cada célula para alternar: <span className="font-semibold text-emerald-700">P</span> (presente),{" "}
        <span className="font-semibold text-rose-700">F</span> (falta),{" "}
        <span className="font-semibold text-rose-600">J</span> (falta justificada). A frequência é calculada com base
        nas aulas já lançadas.
      </p>
      <div className="overflow-x-auto rounded-lg border border-[var(--card-border)]">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]">
              <th
                className="sticky left-0 z-20 min-w-[2.5rem] border-r border-[var(--card-border)] bg-[var(--igh-surface)] px-2 py-2 text-left text-xs font-semibold text-[var(--text-muted)]"
                scope="col"
              >
                N.º
              </th>
              <th
                className="sticky left-[2.5rem] z-20 min-w-[12rem] border-r border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-left text-xs font-semibold text-[var(--text-primary)]"
                scope="col"
              >
                Aluno(a)
              </th>
              <th
                colSpan={sessions.length}
                className="border-b border-[var(--card-border)] px-2 py-1 text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]"
                scope="colgroup"
              >
                Aula
              </th>
              <th
                className="min-w-[5.5rem] border-l border-[var(--card-border)] px-2 py-2 text-center text-xs font-semibold text-[var(--text-primary)]"
                scope="col"
              >
                Frequência
              </th>
            </tr>
            <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]/80">
              <th className="sticky left-0 z-20 border-r border-[var(--card-border)] bg-[var(--igh-surface)]/80" />
              <th className="sticky left-[2.5rem] z-20 border-r border-[var(--card-border)] bg-[var(--igh-surface)]/80" />
              {sessions.map((s) => (
                <th
                  key={s.id}
                  className="min-w-[2.75rem] px-1 py-1 text-center text-[10px] font-semibold text-[var(--text-muted)]"
                  scope="col"
                  title={s.lessonTitle ?? undefined}
                >
                  {s.lessonNumber}
                </th>
              ))}
              <th className="border-l border-[var(--card-border)]" />
            </tr>
            <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]/60">
              <th className="sticky left-0 z-20 border-r border-[var(--card-border)] bg-[var(--igh-surface)]/60" />
              <th className="sticky left-[2.5rem] z-20 border-r border-[var(--card-border)] bg-[var(--igh-surface)]/60" />
              {sessions.map((s) => (
                <th
                  key={`${s.id}-date`}
                  className="min-w-[2.75rem] px-1 py-1 text-center text-[10px] font-medium text-[var(--text-muted)]"
                  scope="col"
                >
                  {s.sessionDateLabel}
                </th>
              ))}
              <th className="border-l border-[var(--card-border)]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.enrollmentId} className="border-b border-[var(--card-border)] last:border-b-0">
                <td className="sticky left-0 z-10 border-r border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1.5 text-xs text-[var(--text-muted)]">
                  {index + 1}
                </td>
                <td className="sticky left-[2.5rem] z-10 max-w-[14rem] truncate border-r border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)]">
                  {row.studentName}
                  {row.enrollmentStatus === "SUSPENDED" && (
                    <span className="ml-1.5 inline-flex rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900 dark:text-amber-200">
                      Susp.
                    </span>
                  )}
                </td>
                {sessions.map((s) => {
                  const mark = row.cells[s.id] ?? null;
                  const key = `${row.enrollmentId}:${s.id}`;
                  return (
                    <td key={s.id} className="px-1 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => void handleCellClick(row.enrollmentId, s.id)}
                        className={cellClass(mark, savingKey === key)}
                        title={`${row.studentName} — ${s.sessionDateLabel}: ${markLabel(mark)}`}
                        aria-label={`Frequência de ${row.studentName} em ${s.sessionDateLabel}: ${markLabel(mark)}`}
                      >
                        {mark ?? ""}
                      </button>
                    </td>
                  );
                })}
                <td className="border-l border-[var(--card-border)] px-2 py-1.5 text-center text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {row.frequencyPercent != null ? `${row.frequencyPercent.toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
