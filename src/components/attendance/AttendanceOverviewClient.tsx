"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

export type AttendanceItem = {
  id: string;
  classGroupId: string;
  classGroupStatus: string;
  courseName: string;
  teacherName: string;
  sessionDate: string;
  sessionStatus: string;
  sessionStartTime: string;
  sessionEndTime: string;
  lessonTitle: string | null;
  studentName: string;
  enrollmentStatus: string;
  present: boolean;
  absenceJustification: string | null;
  updatedAt: string;
};

type ClassGroupOption = { id: string; label: string };

export function AttendanceOverviewClient({
  apiUrl,
  classGroupsApiUrl,
  pageTitle,
  pageDescription,
}: {
  apiUrl: string;
  classGroupsApiUrl: string;
  pageTitle: string;
  pageDescription: string;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [truncated, setTruncated] = useState(false);
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
      const json = (await res.json()) as ApiResponse<{ items: AttendanceItem[]; truncated: boolean }>;
      if (!res.ok || !json?.ok) {
        toast.push(
          "error",
          json && !json.ok && "error" in json ? json.error.message : "Falha ao carregar frequência.",
        );
        return;
      }
      setItems(json.data.items);
      setTruncated(json.data.truncated);
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

  const presentCount = useMemo(() => items.filter((i) => i.present).length, [items]);
  const absentCount = useMemo(() => items.filter((i) => !i.present).length, [items]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{pageTitle}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{pageDescription}</p>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Registros</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{items.length}</div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Presenças</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {presentCount}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Ausências</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {absentCount}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Limite</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">
                {truncated ? "Lista limitada aos últimos registros." : "Todos os registros carregados."}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Curso</Th>
                  <Th>Status turma</Th>
                  <Th>Professor</Th>
                  <Th>Sessão</Th>
                  <Th>Aula</Th>
                  <Th>Aluno</Th>
                  <Th>Matrícula</Th>
                  <Th>Presença</Th>
                  <Th>Justificativa (ausência)</Th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <Td colSpan={10} className="text-center text-[var(--text-muted)]">
                      Nenhum registro de frequência encontrado.
                    </Td>
                  </tr>
                ) : (
                  items.map((r) => (
                    <tr key={r.id}>
                      <Td className="whitespace-nowrap text-sm text-[var(--text-muted)]">
                        {new Date(r.sessionDate + "T12:00:00").toLocaleDateString("pt-BR")}
                      </Td>
                      <Td className="max-w-[10rem] text-sm text-[var(--text-primary)]">{r.courseName}</Td>
                      <Td className="whitespace-nowrap text-xs text-[var(--text-muted)]">{r.classGroupStatus}</Td>
                      <Td className="max-w-[10rem] text-sm">{r.teacherName}</Td>
                      <Td className="whitespace-nowrap text-xs text-[var(--text-secondary)]">
                        {r.sessionStatus} · {r.sessionStartTime}–{r.sessionEndTime}
                      </Td>
                      <Td className="max-w-[8rem] text-sm text-[var(--text-secondary)]">{r.lessonTitle ?? "—"}</Td>
                      <Td className="text-sm font-medium text-[var(--text-primary)]">{r.studentName}</Td>
                      <Td className="text-xs text-[var(--text-muted)]">{r.enrollmentStatus}</Td>
                      <Td className="text-sm">{r.present ? "Presente" : "Ausente"}</Td>
                      <Td className="max-w-[14rem] whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                        {!r.present && r.absenceJustification ? r.absenceJustification : "—"}
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
