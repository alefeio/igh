"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import { Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import {
  classGroupPoloLabel,
  classGroupUnitGroupKey,
  classGroupUnitLabel,
  type ClassGroupUnit,
} from "@/lib/class-group-unit";
import { compareBySchedule, DAY_ORDER, timeToMinutes } from "@/lib/teacher-schedule-grid";
import { pickCurrentCycle } from "@/lib/cycles";

type Course = { id: string; name: string };
type Teacher = { id: string; name: string };
type Cycle = { id: string; cycle: number; year: number };

type PoloLocation = { id: string; name: string; polo: { id: string; name: string } } | null;

type ClassGroup = {
  id: string;
  courseId: string;
  teacherId: string;
  cycleId: string;
  daysOfWeek: string[];
  startDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  capacity: number;
  status: string;
  location: string | null;
  course: Course;
  teacher: Teacher;
  /** Titular e adicionais; a turma entra na grade de cada um deles. */
  teachers?: Teacher[];
  cycle?: Cycle | null;
  poloLocation?: PoloLocation;
  enrollmentsCount?: number;
};

type ViewMode = "teacher" | "weekday";

const DAY_LABELS: Record<string, string> = {
  SEG: "Segunda",
  TER: "Terça",
  QUA: "Quarta",
  QUI: "Quinta",
  SEX: "Sexta",
  SAB: "Sábado",
  DOM: "Domingo",
};

const STATUS_IN_SCHEDULE = ["PLANEJADA", "ABERTA", "EM_ANDAMENTO"] as const;
const ALL = "";
const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "teacher", label: "Por professor" },
  { value: "weekday", label: "Por dia da semana" },
];

function formatDays(days: string[]): string {
  if (!days?.length) return "—";
  const sorted = [...days].sort(
    (a, b) => DAY_ORDER.indexOf(a as (typeof DAY_ORDER)[number]) - DAY_ORDER.indexOf(b as (typeof DAY_ORDER)[number])
  );
  return sorted.map((d) => DAY_LABELS[d] ?? d).join(", ");
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const datePart = d.trim().split("T")[0];
  if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, day] = datePart.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toUnit(cg: ClassGroup): ClassGroupUnit {
  if (!cg.poloLocation) return null;
  return {
    id: cg.poloLocation.id,
    name: cg.poloLocation.name,
    poloId: cg.poloLocation.polo.id,
    poloName: cg.poloLocation.polo.name,
  };
}

function unitFullLabel(cg: ClassGroup): string {
  const unit = toUnit(cg);
  const unitName = classGroupUnitLabel(unit, cg.location);
  const polo = classGroupPoloLabel(unit);
  return polo ? `${polo} | ${unitName}` : unitName;
}

function cycleLabel(c: Cycle): string {
  return `Ciclo ${c.cycle}/${c.year}`;
}

function teachersOf(cg: ClassGroup): Teacher[] {
  if (cg.teachers?.length) return cg.teachers;
  return cg.teacher ? [cg.teacher] : [];
}

function teachersLabel(cg: ClassGroup): string {
  const list = teachersOf(cg);
  if (list.length === 0) return "Sem professor";
  return list.map((t) => t.name).join(", ");
}

function compareByStartTime(a: ClassGroup, b: ClassGroup): number {
  const byTime = (timeToMinutes(a.startTime) ?? 0) - (timeToMinutes(b.startTime) ?? 0);
  if (byTime !== 0) return byTime;
  return (a.course?.name ?? "").localeCompare(b.course?.name ?? "", "pt-BR");
}

type TeacherGroup = {
  teacherId: string;
  teacherName: string;
  /** Uma linha por turma, na ordem em que caem na semana. */
  rows: ClassGroup[];
  totalStudents: number;
};

type WeekdayGroup = {
  day: string;
  dayLabel: string;
  rows: ClassGroup[];
  totalStudents: number;
};

export default function QuadroHorariosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [currentCycleId, setCurrentCycleId] = useState<string | null>(null);
  const [includeEncerradas, setIncludeEncerradas] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("teacher");

  const [cycleFilter, setCycleFilter] = useState<string>(ALL);
  const [teacherFilter, setTeacherFilter] = useState<string>(ALL);
  const [courseFilter, setCourseFilter] = useState<string>(ALL);
  const [unitFilter, setUnitFilter] = useState<string>(ALL);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsRes, cyclesRes] = await Promise.all([
        fetch("/api/class-groups"),
        fetch("/api/cycles"),
      ]);
      const groupsJson = (await groupsRes.json()) as ApiResponse<{ classGroups: ClassGroup[] }>;
      if (!groupsRes.ok || !groupsJson.ok) {
        toast.push("error", !groupsJson.ok ? groupsJson.error?.message ?? "Falha ao carregar." : "Falha ao carregar.");
        return;
      }
      setClassGroups(groupsJson.data.classGroups ?? []);

      const cyclesJson = (await cyclesRes.json().catch(() => null)) as ApiResponse<{ cycles: Cycle[] }> | null;
      const cyclesList = [...(cyclesRes.ok && cyclesJson?.ok ? cyclesJson.data.cycles : [])].sort(
        (a, b) => b.year - a.year || b.cycle - a.cycle
      );
      setCycles(cyclesList);
      const current = pickCurrentCycle(cyclesList);
      setCurrentCycleId(current?.id ?? null);
      if (current) setCycleFilter((prev) => (prev === ALL ? current.id : prev));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const byStatus = useMemo(
    () =>
      includeEncerradas
        ? classGroups
        : classGroups.filter((cg) => STATUS_IN_SCHEDULE.includes(cg.status as (typeof STATUS_IN_SCHEDULE)[number])),
    [classGroups, includeEncerradas]
  );

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const cg of byStatus) {
      for (const t of teachersOf(cg)) map.set(t.id, t.name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [byStatus]);

  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const cg of byStatus) {
      if (cg.course?.id) map.set(cg.course.id, cg.course.name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [byStatus]);

  const unitOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const cg of byStatus) {
      map.set(classGroupUnitGroupKey(toUnit(cg), cg.location), unitFullLabel(cg));
    }
    return [...map.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [byStatus]);

  const filtered = useMemo(
    () =>
      byStatus.filter((cg) => {
        if (cycleFilter !== ALL && (cg.cycle?.id ?? cg.cycleId) !== cycleFilter) return false;
        if (teacherFilter !== ALL && !teachersOf(cg).some((t) => t.id === teacherFilter)) return false;
        if (courseFilter !== ALL && cg.course?.id !== courseFilter) return false;
        if (unitFilter !== ALL && classGroupUnitGroupKey(toUnit(cg), cg.location) !== unitFilter) return false;
        return true;
      }),
    [byStatus, cycleFilter, teacherFilter, courseFilter, unitFilter]
  );

  /** Grade separada por professor, como pede o quadro impresso. */
  const teacherGroups = useMemo<TeacherGroup[]>(() => {
    const byTeacher = new Map<string, { name: string; list: ClassGroup[] }>();
    for (const cg of filtered) {
      const involved = teachersOf(cg);
      const keys = involved.length > 0 ? involved : [{ id: "sem-professor", name: "Sem professor" }];
      for (const t of keys) {
        const entry = byTeacher.get(t.id) ?? { name: t.name, list: [] };
        entry.list.push(cg);
        byTeacher.set(t.id, entry);
      }
    }

    return [...byTeacher.entries()]
      .map(([teacherId, { name, list }]) => {
        const ordered = [...list].sort(compareBySchedule);
        return {
          teacherId,
          teacherName: name,
          totalStudents: ordered.reduce((sum, cg) => sum + (cg.enrollmentsCount ?? 0), 0),
          rows: ordered,
        };
      })
      .sort((a, b) => a.teacherName.localeCompare(b.teacherName, "pt-BR"));
  }, [filtered]);

  /** Grade separada por dia da semana (turma com vários dias aparece em cada um). */
  const weekdayGroups = useMemo<WeekdayGroup[]>(() => {
    const byDay = new Map<string, ClassGroup[]>();
    for (const day of DAY_ORDER) byDay.set(day, []);

    for (const cg of filtered) {
      const days =
        Array.isArray(cg.daysOfWeek) && cg.daysOfWeek.length > 0
          ? cg.daysOfWeek
          : ["sem-dia"];
      for (const day of days) {
        const key = DAY_ORDER.includes(day as (typeof DAY_ORDER)[number]) ? day : "sem-dia";
        const list = byDay.get(key) ?? [];
        list.push(cg);
        byDay.set(key, list);
      }
    }

    const orderedKeys = [
      ...DAY_ORDER.filter((day) => (byDay.get(day)?.length ?? 0) > 0),
      ...((byDay.get("sem-dia")?.length ?? 0) > 0 ? (["sem-dia"] as const) : []),
    ];

    return orderedKeys.map((day) => {
      const ordered = [...(byDay.get(day) ?? [])].sort(compareByStartTime);
      return {
        day,
        dayLabel: DAY_LABELS[day] ?? "Sem dia definido",
        totalStudents: ordered.reduce((sum, cg) => sum + (cg.enrollmentsCount ?? 0), 0),
        rows: ordered,
      };
    });
  }, [filtered]);

  const totalTurmas = filtered.length;
  const selectedCycleLabel = cycles.find((c) => c.id === cycleFilter);
  const sectionCount = viewMode === "teacher" ? teacherGroups.length : weekdayGroups.length;
  const sectionNoun =
    viewMode === "teacher"
      ? sectionCount === 1
        ? "professor"
        : "professores"
      : sectionCount === 1
        ? "dia"
        : "dias";

  function handleExportExcel() {
    if (totalTurmas === 0) return;
    try {
      const rows =
        viewMode === "teacher"
          ? teacherGroups.flatMap((group) =>
              group.rows.map((cg) => ({
                "Professor(a)": group.teacherName,
                Curso: cg.course?.name ?? "—",
                "Dias da semana": formatDays(cg.daysOfWeek),
                Horário: cg.startTime && cg.endTime ? `${cg.startTime} – ${cg.endTime}` : "—",
                "Polo/Unidade": unitFullLabel(cg),
                "Início da turma": formatDate(cg.startDate),
                "Total de alunos": cg.enrollmentsCount ?? 0,
                Ciclo: cg.cycle ? cycleLabel(cg.cycle) : "—",
              }))
            )
          : weekdayGroups.flatMap((group) =>
              group.rows.map((cg) => ({
                "Dia da semana": group.dayLabel,
                Curso: cg.course?.name ?? "—",
                "Professor(a)": teachersLabel(cg),
                Horário: cg.startTime && cg.endTime ? `${cg.startTime} – ${cg.endTime}` : "—",
                "Polo/Unidade": unitFullLabel(cg),
                "Início da turma": formatDate(cg.startDate),
                "Total de alunos": cg.enrollmentsCount ?? 0,
                Ciclo: cg.cycle ? cycleLabel(cg.cycle) : "—",
              }))
            );
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Quadro de horários");
      XLSX.writeFile(wb, `quadro_horarios_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.push("success", "Planilha exportada.");
    } catch {
      toast.push("error", "Falha ao exportar Excel.");
    }
  }

  function handleExportPdf() {
    const el = document.getElementById("quadro-print-area");
    if (!el) return;
    const html = el.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.push("error", "Permita pop-ups para exportar o PDF.");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Quadro de Horários dos Cursos</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: system-ui, -apple-system, sans-serif; padding: 0; color: #171717; }
            h1 { font-size: 1.4rem; margin-bottom: 4px; }
            h2 { font-size: 1rem; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 2px solid #171717; }
            .sub { font-size: 0.8rem; color: #52525b; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 0.78rem; margin-bottom: 8px; }
            th, td { border: 1px solid #d4d4d8; padding: 6px 8px; text-align: left; }
            th { background: #f5f7fa; font-weight: 600; }
            tr:nth-child(even) td { background: #fafafa; }
            section { break-inside: avoid; }
          </style>
        </head>
        <body>
          ${html}
          <script>
            setTimeout(function() { window.print(); window.close(); }, 250);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    toast.push("success", "Use a opção \"Salvar como PDF\" na janela de impressão.");
  }

  const filterSelectClass =
    "min-h-[38px] w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--text-primary)] shadow-sm focus:border-[var(--igh-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)]/20";

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow="Gestão"
        title="Quadro de horários dos cursos"
        description={
          viewMode === "teacher"
            ? "Grade semanal por professor. Exporte ou imprima para disponibilizar no instituto."
            : "Grade semanal por dia da semana. Exporte ou imprima para disponibilizar no instituto."
        }
        rightSlot={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div
              className="flex w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-0.5 text-sm shadow-sm sm:w-auto"
              role="group"
              aria-label="Modo de visualização"
            >
              {VIEW_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setViewMode(option.value)}
                  aria-pressed={viewMode === option.value}
                  className={`flex-1 rounded-lg px-3 py-1.5 touch-manipulation sm:flex-none ${
                    viewMode === option.value
                      ? "bg-[var(--igh-primary)] text-white"
                      : "text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={includeEncerradas}
                onChange={(e) => setIncludeEncerradas(e.target.checked)}
              />
              Incluir turmas encerradas
            </label>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                variant="secondary"
                onClick={handleExportExcel}
                disabled={loading || totalTurmas === 0}
                className="w-full sm:w-auto"
              >
                Exportar Excel
              </Button>
              <Button onClick={handleExportPdf} disabled={loading || totalTurmas === 0} className="w-full sm:w-auto">
                Exportar / Imprimir PDF
              </Button>
            </div>
          </div>
        }
      />

      <SectionCard title="Filtros" description="O quadro abre no ciclo atual." variant="elevated">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Ciclo</span>
            <select value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)} className={filterSelectClass}>
              <option value={ALL}>Todos os ciclos</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id === currentCycleId ? `${cycleLabel(c)} (atual)` : cycleLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Professor</span>
            <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className={filterSelectClass}>
              <option value={ALL}>Todos os professores</option>
              {teacherOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Curso</span>
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className={filterSelectClass}>
              <option value={ALL}>Todos os cursos</option>
              {courseOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Polo/Unidade</span>
            <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className={filterSelectClass}>
              <option value={ALL}>Todos os polos e unidades</option>
              {unitOptions.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Turmas e horários"
        description={
          loading
            ? "Carregando turmas…"
            : totalTurmas === 0
              ? "Nenhuma turma nos filtros selecionados."
              : `${totalTurmas} ${totalTurmas === 1 ? "turma" : "turmas"} em ${sectionCount} ${sectionNoun}.`
        }
        variant="elevated"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-14" role="status">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--igh-primary)]/20" aria-hidden />
            <p className="mt-3 text-sm text-[var(--text-muted)]">Carregando…</p>
          </div>
        ) : totalTurmas === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/40 px-6 py-10 text-center text-sm text-[var(--text-muted)]">
            Nenhuma turma encontrada para exibir no quadro.
          </div>
        ) : viewMode === "teacher" ? (
          <>
            {/* Área usada na impressão / PDF */}
            <div id="quadro-print-area" className="sr-only print:not-sr-only">
              <h1>Quadro de Horários dos Cursos</h1>
              <p className="sub">
                {selectedCycleLabel ? `${cycleLabel(selectedCycleLabel)} — ` : ""}
                Por professor — Gerado em{" "}
                {new Date().toLocaleDateString("pt-BR", { dateStyle: "long" })} — Para consulta dos alunos.
              </p>
              {teacherGroups.map((group) => (
                <section key={group.teacherId}>
                  <h2>
                    {group.teacherName} — {group.rows.length} {group.rows.length === 1 ? "turma" : "turmas"},{" "}
                    {group.totalStudents} {group.totalStudents === 1 ? "aluno" : "alunos"}
                  </h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Curso</th>
                        <th>Dias da semana</th>
                        <th>Horário</th>
                        <th>Polo/Unidade</th>
                        <th>Início da turma</th>
                        <th>Alunos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((cg) => (
                        <tr key={cg.id}>
                          <td>{cg.course?.name ?? "—"}</td>
                          <td>{formatDays(cg.daysOfWeek)}</td>
                          <td>{cg.startTime && cg.endTime ? `${cg.startTime} – ${cg.endTime}` : "—"}</td>
                          <td>{unitFullLabel(cg)}</td>
                          <td>{formatDate(cg.startDate)}</td>
                          <td>{cg.enrollmentsCount ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>

            <div className="flex flex-col gap-7 print:hidden">
              {teacherGroups.map((group) => (
                <section key={group.teacherId}>
                  <div className="mb-3 flex flex-wrap items-baseline gap-2 border-b border-[var(--card-border)] pb-2">
                    <h3 className="text-base font-bold text-[var(--text-primary)]">{group.teacherName}</h3>
                    <span className="text-xs text-[var(--text-muted)]">
                      {group.rows.length} {group.rows.length === 1 ? "turma" : "turmas"} · {group.totalStudents}{" "}
                      {group.totalStudents === 1 ? "aluno" : "alunos"}
                    </span>
                  </div>
                  <TableShell>
                    <thead>
                      <tr>
                        <Th>Curso</Th>
                        <Th>Dias da semana</Th>
                        <Th>Horário</Th>
                        <Th>Polo/Unidade</Th>
                        <Th>Início da turma</Th>
                        <Th>Alunos</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((cg) => (
                        <tr key={cg.id}>
                          <Td className="font-medium text-[var(--text-primary)]">{cg.course?.name ?? "—"}</Td>
                          <Td className="text-[var(--text-secondary)]">{formatDays(cg.daysOfWeek)}</Td>
                          <Td className="text-[var(--text-secondary)]">
                            {cg.startTime && cg.endTime ? `${cg.startTime} – ${cg.endTime}` : "—"}
                          </Td>
                          <Td className="text-[var(--text-secondary)]">{unitFullLabel(cg)}</Td>
                          <Td className="text-[var(--text-secondary)]">{formatDate(cg.startDate)}</Td>
                          <Td className="text-[var(--text-secondary)]">{cg.enrollmentsCount ?? 0}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableShell>
                </section>
              ))}
            </div>
          </>
        ) : (
          <>
            <div id="quadro-print-area" className="sr-only print:not-sr-only">
              <h1>Quadro de Horários dos Cursos</h1>
              <p className="sub">
                {selectedCycleLabel ? `${cycleLabel(selectedCycleLabel)} — ` : ""}
                Por dia da semana — Gerado em{" "}
                {new Date().toLocaleDateString("pt-BR", { dateStyle: "long" })} — Para consulta dos alunos.
              </p>
              {weekdayGroups.map((group) => (
                <section key={group.day}>
                  <h2>
                    {group.dayLabel} — {group.rows.length} {group.rows.length === 1 ? "turma" : "turmas"},{" "}
                    {group.totalStudents} {group.totalStudents === 1 ? "aluno" : "alunos"}
                  </h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Curso</th>
                        <th>Professor(a)</th>
                        <th>Horário</th>
                        <th>Polo/Unidade</th>
                        <th>Início da turma</th>
                        <th>Alunos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((cg) => (
                        <tr key={`${group.day}-${cg.id}`}>
                          <td>{cg.course?.name ?? "—"}</td>
                          <td>{teachersLabel(cg)}</td>
                          <td>{cg.startTime && cg.endTime ? `${cg.startTime} – ${cg.endTime}` : "—"}</td>
                          <td>{unitFullLabel(cg)}</td>
                          <td>{formatDate(cg.startDate)}</td>
                          <td>{cg.enrollmentsCount ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>

            <div className="flex flex-col gap-7 print:hidden">
              {weekdayGroups.map((group) => (
                <section key={group.day}>
                  <div className="mb-3 flex flex-wrap items-baseline gap-2 border-b border-[var(--card-border)] pb-2">
                    <h3 className="text-base font-bold text-[var(--text-primary)]">{group.dayLabel}</h3>
                    <span className="text-xs text-[var(--text-muted)]">
                      {group.rows.length} {group.rows.length === 1 ? "turma" : "turmas"} · {group.totalStudents}{" "}
                      {group.totalStudents === 1 ? "aluno" : "alunos"}
                    </span>
                  </div>
                  <TableShell>
                    <thead>
                      <tr>
                        <Th>Curso</Th>
                        <Th>Professor(a)</Th>
                        <Th>Horário</Th>
                        <Th>Polo/Unidade</Th>
                        <Th>Início da turma</Th>
                        <Th>Alunos</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((cg) => (
                        <tr key={`${group.day}-${cg.id}`}>
                          <Td className="font-medium text-[var(--text-primary)]">{cg.course?.name ?? "—"}</Td>
                          <Td className="text-[var(--text-secondary)]">{teachersLabel(cg)}</Td>
                          <Td className="text-[var(--text-secondary)]">
                            {cg.startTime && cg.endTime ? `${cg.startTime} – ${cg.endTime}` : "—"}
                          </Td>
                          <Td className="text-[var(--text-secondary)]">{unitFullLabel(cg)}</Td>
                          <Td className="text-[var(--text-secondary)]">{formatDate(cg.startDate)}</Td>
                          <Td className="text-[var(--text-secondary)]">{cg.enrollmentsCount ?? 0}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableShell>
                </section>
              ))}
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
