"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";
import {
  attendancePercent,
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

const MARK_BUTTONS: { mark: AttendanceMark; label: string }[] = [
  { mark: "P", label: "Presença" },
  { mark: "J", label: "Justificado" },
  { mark: "F", label: "Falta" },
];

function markButtonClass(
  option: AttendanceMark,
  selected: AttendanceMark | null,
  position: "first" | "middle" | "last"
): string {
  const rounded =
    position === "first"
      ? "rounded-l-md rounded-r-none"
      : position === "last"
        ? "rounded-r-md rounded-l-none"
        : "rounded-none";
  const base = `inline-flex h-7 w-6 shrink-0 items-center justify-center border text-[11px] font-bold leading-none transition-all focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-1 disabled:cursor-wait ${rounded}`;

  const isSelected = selected === option;
  const hasSelection = selected != null;

  if (option === "P") {
    if (isSelected) {
      return `${base} z-[1] border-emerald-600 bg-emerald-500 text-white shadow-sm ring-1 ring-emerald-600 dark:border-emerald-400 dark:bg-emerald-500 dark:text-emerald-950`;
    }
    return `${base} border-emerald-400/70 bg-emerald-100 text-emerald-800 ${hasSelection ? "opacity-40" : "opacity-80"} hover:opacity-100 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200`;
  }
  if (option === "J") {
    if (isSelected) {
      return `${base} z-[1] -ml-px border-amber-600 bg-amber-400 text-amber-950 shadow-sm ring-1 ring-amber-600 dark:border-amber-300 dark:bg-amber-400 dark:text-amber-950`;
    }
    return `${base} -ml-px border-amber-400/70 bg-amber-100 text-amber-900 ${hasSelection ? "opacity-40" : "opacity-80"} hover:opacity-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200`;
  }
  // F
  if (isSelected) {
    return `${base} z-[1] -ml-px border-rose-600 bg-rose-500 text-white shadow-sm ring-1 ring-rose-600 dark:border-rose-400 dark:bg-rose-500 dark:text-rose-950`;
  }
  return `${base} -ml-px border-rose-400/70 bg-rose-100 text-rose-800 ${hasSelection ? "opacity-40" : "opacity-80"} hover:opacity-100 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200`;
}

function markLabel(mark: AttendanceMark | null): string {
  if (mark === "P") return "P (presente)";
  if (mark === "F") return "F (falta)";
  if (mark === "J") return "J (justificado)";
  return "não marcado";
}

function markPosition(index: number, total: number): "first" | "middle" | "last" {
  if (index === 0) return "first";
  if (index === total - 1) return "last";
  return "middle";
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

  const handleMarkChange = async (
    enrollmentId: string,
    sessionId: string,
    next: AttendanceMark
  ) => {
    const rowIdx = rowIndexByEnrollment.get(enrollmentId);
    if (rowIdx === undefined) return;

    const row = rows[rowIdx];
    const current = row.cells[sessionId] ?? null;
    if (current === next) return;

    const key = `${enrollmentId}:${sessionId}`;
    const prevRows = rows;
    const sessionIds = sessions.map((s) => s.id);
    const newCells = { ...row.cells, [sessionId]: next };
    const stats = recomputeRowStats(newCells, sessionIds);

    setRows((prev) =>
      prev.map((r, i) => (i === rowIdx ? { ...r, cells: newCells, ...stats } : r))
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
        Em cada célula, clique direto no status:{" "}
        <span className="font-semibold text-emerald-700">P</span> (presente),{" "}
        <span className="font-semibold text-amber-700">J</span> (justificado) ou{" "}
        <span className="font-semibold text-rose-700">F</span> (falta). Células sem destaque ainda
        não foram lançadas. A frequência é calculada com base nas aulas já lançadas.
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
                  className="min-w-[4.75rem] px-1 py-1 text-center text-[10px] font-semibold text-[var(--text-muted)]"
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
                  className="min-w-[4.75rem] px-1 py-1 text-center text-[10px] font-medium text-[var(--text-muted)]"
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
                  const saving = savingKey === key;
                  return (
                    <td key={s.id} className="px-0.5 py-1 text-center">
                      <div
                        className={`inline-flex items-stretch ${saving ? "pointer-events-none opacity-60" : ""}`}
                        role="group"
                        title={`${row.studentName} — ${s.sessionDateLabel}: ${markLabel(mark)}`}
                        aria-label={`Frequência de ${row.studentName} em ${s.sessionDateLabel}`}
                      >
                        {MARK_BUTTONS.map((btn, btnIndex) => {
                          const selected = mark === btn.mark;
                          return (
                            <button
                              key={btn.mark}
                              type="button"
                              disabled={saving}
                              aria-pressed={selected}
                              aria-label={`${btn.label} (${btn.mark})`}
                              title={btn.label}
                              onClick={() => {
                                void handleMarkChange(row.enrollmentId, s.id, btn.mark);
                              }}
                              className={markButtonClass(
                                btn.mark,
                                mark,
                                markPosition(btnIndex, MARK_BUTTONS.length)
                              )}
                            >
                              {btn.mark}
                            </button>
                          );
                        })}
                      </div>
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
