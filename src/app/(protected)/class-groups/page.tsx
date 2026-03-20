"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

function apiErrorMessage(json: ApiResponse<unknown> | null, fallback: string): string {
  if (json && !json.ok) return json.error.message;
  return fallback;
}

type Course = { id: string; name: string; workloadHours: number | null };
type Teacher = { id: string; name: string };

type ClassGroup = {
  id: string;
  courseId: string;
  teacherId: string;
  daysOfWeek: string[];
  startDate?: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  capacity: number;
  status:
    | "PLANEJADA"
    | "ABERTA"
    | "EM_ANDAMENTO"
    | "ENCERRADA"
    | "CANCELADA"
    | "INTERNO"
    | "EXTERNO";
  location: string | null;
  createdAt: string;
  course: Course;
  teacher: Teacher;
  sessions?: ClassSession[];
  totalSessions?: number;
  totalHours?: number;
  enrollmentsCount?: number;
};

type ClassSession = {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: "SCHEDULED" | "LIBERADA" | "CANCELED";
};

type TimeSlot = {
  id: string;
  startTime: string;
  endTime: string;
  name: string | null;
  isActive: boolean;
};

const STATUS_TONE: Record<ClassGroup["status"], Parameters<typeof Badge>[0]["tone"]> = {
  PLANEJADA: "zinc",
  ABERTA: "blue",
  EM_ANDAMENTO: "amber",
  ENCERRADA: "green",
  CANCELADA: "red",
  INTERNO: "violet",
  EXTERNO: "blue",
};

export default function ClassGroupsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ClassGroup[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<ClassGroup["status"][]>([]);
  const [editing, setEditing] = useState<ClassGroup | null>(null);

  const [courseId, setCourseId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(["TER", "QUI"]);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [capacity, setCapacity] = useState("20");
  const [status, setStatus] = useState<ClassGroup["status"]>("PLANEJADA");
  const [location, setLocation] = useState("");
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState("");

  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [saving, setSaving] = useState(false);

  const locationSuggestions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((cg) => {
      if (cg.location && cg.location.trim()) set.add(cg.location.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items]);

  const filteredLocationSuggestions = useMemo(() => {
    const q = location.trim().toLowerCase();
    if (!q) return locationSuggestions;
    return locationSuggestions.filter((s) => s.toLowerCase().includes(q));
  }, [locationSuggestions, location]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId),
    [courses, courseId],
  );
  const courseHasWorkload = selectedCourse != null && (selectedCourse.workloadHours ?? 0) > 0;

  const canSubmit = useMemo(() => {
    const base =
      courseId.length > 0 &&
      teacherId.length > 0 &&
      daysOfWeek.length > 0 &&
      startDate.trim().length > 0 &&
      startTime.trim().length > 0 &&
      endTime.trim().length > 0 &&
      Number(capacity) > 0;
    return base && (editing != null || courseHasWorkload);
  }, [courseId, teacherId, daysOfWeek, startDate, startTime, endTime, capacity, courseHasWorkload, editing]);

  function resetForm() {
    setCourseId("");
    setTeacherId("");
    setDaysOfWeek(["TER", "QUI"]);
    setStartDate("");
    setStartTime("08:00");
    setEndTime("10:00");
    setCapacity("20");
    setStatus("PLANEJADA");
    setLocation("");
    setSelectedTimeSlotId("");
    setEditing(null);
    setSessions([]);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(cg: ClassGroup) {
    setEditing(cg);
    setCourseId(cg.courseId);
    setTeacherId(cg.teacherId);
    setDaysOfWeek(cg.daysOfWeek);
    setStartDate(cg.startDate ? String(cg.startDate).slice(0, 10) : "");
    setStartTime(cg.startTime);
    setEndTime(cg.endTime);
    setCapacity(String(cg.capacity));
    setStatus(cg.status);
    setLocation(cg.location ?? "");
    const matchingSlot = timeSlots.find(
      (s) => s.startTime === cg.startTime && s.endTime === cg.endTime
    );
    setSelectedTimeSlotId(matchingSlot?.id ?? "");
    setOpen(true);
    if (cg.sessions?.length !== undefined) {
      setSessions(cg.sessions);
    } else {
      void loadSessions(cg.id);
    }
  }

  async function loadSessions(classGroupId: string) {
    setSessionsLoading(true);
    try {
      const res = await fetch(`/api/class-groups/${classGroupId}/sessions`);
      const json = await parseJsonSafe<{ sessions: ClassSession[] }>(res);
      if (!res.ok || !json?.ok) {
        throw new Error(apiErrorMessage(json, "Falha ao carregar aulas geradas."));
      }
      setSessions(json.data.sessions);
    } catch (e) {
      const err = e as Error;
      toast.push("error", err.message);
    } finally {
      setSessionsLoading(false);
    }
  }

  async function parseJsonSafe<T>(res: Response): Promise<ApiResponse<T> | null> {
    const text = await res.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as ApiResponse<T>;
    } catch {
      return null;
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [cgRes, cRes, tRes, tsRes] = await Promise.all([
        fetch("/api/class-groups"),
        fetch("/api/courses"),
        fetch("/api/teachers"),
        fetch("/api/time-slots?activeOnly=true"),
      ]);

      const [cgJson, cJson, tJson, tsJson] = await Promise.all([
        parseJsonSafe<{ classGroups: ClassGroup[] }>(cgRes),
        parseJsonSafe<{ courses: Course[] }>(cRes),
        parseJsonSafe<{ teachers: Teacher[] }>(tRes),
        parseJsonSafe<{ timeSlots: TimeSlot[] }>(tsRes),
      ]);

      if (!cgRes.ok || !cgJson?.ok)
        throw new Error(cgJson && "error" in cgJson ? cgJson.error.message : "Falha ao carregar turmas.");
      if (!cRes.ok || !cJson?.ok)
        throw new Error(cJson && "error" in cJson ? cJson.error.message : "Falha ao carregar cursos.");
      if (!tRes.ok || !tJson?.ok)
        throw new Error(tJson && "error" in tJson ? tJson.error.message : "Falha ao carregar professores.");

      setItems(cgJson!.data.classGroups);
      setCourses(cJson!.data.courses);
      setTeachers(tJson!.data.teachers);
      setTimeSlots(tsJson?.ok ? tsJson.data.timeSlots : []);
    } catch (e: unknown) {
      toast.push("error", e instanceof Error ? e.message : "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const isEditing = editing != null;
      const payload = {
        courseId,
        teacherId,
        daysOfWeek,
        startDate,
        startTime,
        endTime,
        capacity: Number(capacity),
        status,
        location,
      };

      const url = isEditing ? `/api/class-groups/${editing!.id}` : "/api/class-groups";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await parseJsonSafe<{ classGroup: { id: string } }>(res);
      if (!res.ok || !json?.ok) {
        toast.push("error", apiErrorMessage(json, "Falha ao salvar turma."));
        return;
      }
      toast.push("success", isEditing ? "Turma atualizada." : "Turma criada.");
      setOpen(false);
      resetForm();
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(day: string) {
    setDaysOfWeek((prev) => {
      const isSelected = prev.includes(day);
      if (isSelected) {
        return prev.filter((d) => d !== day);
      }
      const presetTerQui = prev.length === 2 && prev.includes("TER") && prev.includes("QUI");
      const presetQuaSex = prev.length === 2 && prev.includes("QUA") && prev.includes("SEX");
      if (presetTerQui && day === "QUA") return ["QUA", "SEX"];
      if (presetQuaSex && day === "TER") return ["TER", "QUI"];
      return [...prev, day];
    });
  }

  async function inactivateClassGroup(cg: ClassGroup) {
    if (!confirm(`Inativar (cancelar) a turma de ${cg.course.name}?`)) return;
    const res = await fetch(`/api/class-groups/${cg.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "CANCELADA" }),
    });
    const json = await parseJsonSafe<{ classGroup: ClassGroup }>(res);
    if (!res.ok || !json?.ok) {
      toast.push("error", apiErrorMessage(json, "Falha ao inativar turma."));
      return;
    }
    toast.push("success", "Turma cancelada.");
    await loadAll();
  }

  async function reactivateClassGroup(cg: ClassGroup) {
    const res = await fetch(`/api/class-groups/${cg.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "PLANEJADA" }),
    });
    const json = await parseJsonSafe<{ classGroup: ClassGroup }>(res);
    if (!res.ok || !json?.ok) {
      toast.push("error", apiErrorMessage(json, "Falha ao reativar turma."));
      return;
    }
    toast.push("success", "Turma reativada.");
    await loadAll();
  }

  async function deleteClassGroup(cg: ClassGroup) {
    if (!confirm(`Excluir definitivamente esta turma e todas as aulas geradas? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/class-groups/${cg.id}`, { method: "DELETE" });
    const json = await parseJsonSafe<{ deleted: boolean }>(res);
    if (!res.ok || !json?.ok) {
      toast.push("error", apiErrorMessage(json, "Falha ao excluir turma."));
      return;
    }
    toast.push("success", "Turma excluída.");
    await loadAll();
  }

  const normalizeForSearch = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const visibleItems = useMemo(() => {
    let list = items;
    if (statusFilters.length > 0) {
      list = list.filter((cg) => statusFilters.includes(cg.status));
    }
    const q = searchQuery.trim();
    if (q) {
      const qNorm = normalizeForSearch(q);
      const normDigits = (s: string) => s.replace(/\D/g, "");
      list = list.filter((cg) => {
        const courseName = cg.course?.name ?? "";
        const courseMatch = normalizeForSearch(courseName).includes(qNorm);
        const startDateStr = cg.startDate ? String(cg.startDate).slice(0, 10) : "";
        const startDateBr = startDateStr ? startDateStr.split("-").reverse().join("/") : "";
        const dateMatch =
          startDateStr.includes(q) ||
          startDateBr.includes(q) ||
          normDigits(startDateStr).includes(normDigits(q)) ||
          normDigits(startDateBr).includes(normDigits(q));
        const timeMatch =
          (cg.startTime ?? "").toLowerCase().includes(q.toLowerCase()) ||
          (cg.endTime ?? "").toLowerCase().includes(q.toLowerCase());
        return courseMatch || dateMatch || timeMatch;
      });
    }
    return list;
  }, [items, statusFilters, searchQuery]);

  function toggleStatusFilter(status: ClassGroup["status"]) {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }

  const STATUS_OPTIONS: { value: ClassGroup["status"]; label: string }[] = [
    { value: "PLANEJADA", label: "Planejada" },
    { value: "ABERTA", label: "Aberta" },
    { value: "EM_ANDAMENTO", label: "Em andamento" },
    { value: "ENCERRADA", label: "Encerrada" },
    { value: "CANCELADA", label: "Cancelada" },
    { value: "INTERNO", label: "Interno" },
    { value: "EXTERNO", label: "Externo" },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <DashboardHero
        eyebrow="Operação"
        title="Turmas"
        description="Todas as turmas do sistema. Pesquise por curso, data de início ou horário e filtre por status."
        rightSlot={
          <Button onClick={openCreate} className="w-full sm:w-auto">
            Nova turma
          </Button>
        }
      />

      <SectionCard title="Filtros" description="Refine a listagem antes de editar ou criar sessões." variant="elevated">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <Input
              type="text"
              placeholder="Pesquisar por curso, data ou horário"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="theme-input w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--text-muted)]">Status:</span>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleStatusFilter(value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilters.includes(value)
                    ? "bg-[var(--igh-primary)] text-white"
                    : "bg-[var(--igh-surface)] text-[var(--igh-muted)] hover:bg-[var(--card-border)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Listagem de turmas"
        description={
          loading
            ? "Carregando…"
            : `${visibleItems.length} ${visibleItems.length === 1 ? "turma" : "turmas"} com os filtros atuais.`
        }
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-14" role="status">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--igh-primary)]/20" aria-hidden />
            <p className="mt-3 text-sm text-[var(--text-muted)]">Carregando…</p>
          </div>
        ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Turma</Th>
              <Th>Início</Th>
              <Th>Horário</Th>
              <Th>Aulas / Horas</Th>
              <Th>Status</Th>
              <Th>Capacidade</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((cg) => (
              <tr key={cg.id}>
                <Td>
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--text-primary)]">{cg.course.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      Prof: {cg.teacher.name} · {cg.daysOfWeek.join(", ")} · {cg.location ?? "—"}
                    </span>
                  </div>
                </Td>
                <Td>
                  {cg.startDate ? String(cg.startDate).slice(0, 10).split("-").reverse().join("/") : "—"}
                </Td>
                <Td>
                  {cg.startTime} - {cg.endTime}
                </Td>
                <Td>
                  <span className="text-[var(--text-secondary)]">
                    {cg.totalSessions ?? cg.sessions?.length ?? 0} aulas
                    {cg.totalHours != null && ` · ${cg.totalHours}h`}
                  </span>
                </Td>
                <Td>
                  <Badge tone={STATUS_TONE[cg.status]}>{cg.status}</Badge>
                </Td>
                <Td>{cg.enrollmentsCount ?? 0} / {cg.capacity}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openEdit(cg)}>
                      Editar
                    </Button>
                    {cg.status !== "CANCELADA" ? (
                      <Button
                        variant="secondary"
                        onClick={() => inactivateClassGroup(cg)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Inativar
                      </Button>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={() => reactivateClassGroup(cg)}>
                          Reativar
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => deleteClassGroup(cg)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Excluir
                        </Button>
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {visibleItems.length === 0 ? (
              <tr>
                <Td colSpan={7}>
                  <span className="text-[var(--text-secondary)]">
                    {items.length === 0
                      ? "Nenhuma turma cadastrada."
                      : "Nenhuma turma encontrada com os filtros aplicados."}
                  </span>
                </Td>
              </tr>
            ) : null}
          </tbody>
        </TableShell>
        )}
      </SectionCard>

      <Modal
        open={open}
        title={editing ? "Editar turma" : "Nova turma"}
        onClose={() => { setOpen(false); resetForm(); }}
      >
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Curso</label>
            <div className="mt-1">
              <select
                className="theme-input h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)]"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.workloadHours != null && c.workloadHours > 0
                      ? ` (${c.workloadHours}h)`
                      : " (sem carga horária)"}
                  </option>
                ))}
              </select>
            </div>
            {courseId && !courseHasWorkload && !editing && (
              <p className="mt-1 text-sm text-amber-600">
                Este curso não tem carga horária. Para criar a turma e gerar as aulas, edite o curso em <strong>Cursos</strong> e preencha o campo &quot;Carga horária&quot; (em horas).
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Professor</label>
            <div className="mt-1">
              <select
                className="theme-input h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)]"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Dias da semana</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`rounded-md border px-2 py-1 text-xs font-medium ${
                    daysOfWeek.includes(d)
                      ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                      : "border-[var(--card-border)] bg-white text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Padrão: Ter/Qui ou Qua/Sex. Clique em QUA para alternar para Qua/Sex; em TER para voltar a Ter/Qui. Clique em um dia já marcado para desmarcar e personalizar (ex.: SEG e SEX).
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Data de início</label>
            <div className="mt-1">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Horário predefinido (opcional)</label>
            <div className="mt-1">
              <select
                className="theme-input h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)]"
                value={selectedTimeSlotId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedTimeSlotId(id);
                  if (id) {
                    const slot = timeSlots.find((s) => s.id === id);
                    if (slot) {
                      setStartTime(slot.startTime);
                      setEndTime(slot.endTime);
                    }
                  }
                }}
              >
                <option value="">Digitar manualmente</option>
                {timeSlots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || `${s.startTime} - ${s.endTime}`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Selecione um horário cadastrado em Horários para preencher início e fim automaticamente.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Hora de início</label>
              <div className="mt-1">
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => { setStartTime(e.target.value); setSelectedTimeSlotId(""); }}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Hora de fim</label>
              <div className="mt-1">
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => { setEndTime(e.target.value); setSelectedTimeSlotId(""); }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Capacidade</label>
              <div className="mt-1">
                <Input
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <div className="mt-1">
                <select
                  className="theme-input h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)]"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ClassGroup["status"])}
                >
                  <option value="PLANEJADA">PLANEJADA</option>
                  <option value="ABERTA">ABERTA</option>
                  <option value="EM_ANDAMENTO">EM_ANDAMENTO</option>
                  <option value="ENCERRADA">ENCERRADA</option>
                  <option value="CANCELADA">CANCELADA</option>
                  <option value="INTERNO">INTERNO</option>
                  <option value="EXTERNO">EXTERNO</option>
                </select>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Turmas <strong>EXTERNO</strong> não aparecem no site de inscrição. Matrículas apenas por Admin/Master.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Local/Sala (opcional)</label>
            <div className="relative mt-1">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onFocus={() => setLocationDropdownOpen(true)}
                onBlur={() => setTimeout(() => setLocationDropdownOpen(false), 150)}
                placeholder="Digite ou selecione um local"
                className="theme-input h-10 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--igh-primary)]"
              />
              {locationDropdownOpen && filteredLocationSuggestions.length > 0 && (
                <ul
                  className="absolute z-10 mt-0.5 max-h-40 w-full overflow-auto rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] py-1 shadow-md"
                  role="listbox"
                >
                  {filteredLocationSuggestions.map((s) => (
                    <li
                      key={s}
                      role="option"
                      className="cursor-pointer px-3 py-2 text-sm text-[var(--input-text)] hover:bg-[var(--igh-surface)]"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setLocation(s);
                        setLocationDropdownOpen(false);
                      }}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || saving}>
              {saving ? "Salvando" : "Salvar"}
            </Button>
          </div>
        </form>

        <div className="mt-6 border-t border-[var(--card-border)] pt-4">
          <div className="mb-2 text-sm font-semibold">Aulas geradas</div>
          {!editing ? (
            <p className="text-xs text-[var(--text-secondary)]">
              As aulas serão geradas automaticamente após salvar a turma.
            </p>
          ) : sessionsLoading ? (
            <p className="text-xs text-[var(--text-secondary)]">Carregando aulas...</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Nenhuma aula gerada para esta turma.
            </p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto text-xs">
              <p className="mb-1 text-[var(--text-secondary)]">
                Total de aulas: <span className="font-semibold">{sessions.length}</span>
                {editing?.totalHours != null && (
                  <> · Total de horas: <span className="font-semibold">{editing.totalHours}h</span></>
                )}
              </p>
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-[var(--card-border)] px-2 py-1">
                  <span>
                    {s.sessionDate.slice(0, 10).split("-").reverse().join("/")} · {s.startTime} -{" "}
                    {s.endTime}
                  </span>
                  <span className="text-[10px] uppercase text-[var(--text-muted)]">{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
