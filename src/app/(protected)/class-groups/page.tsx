"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import { DEFAULT_CYCLE_ID } from "@/lib/cycles";

function apiErrorMessage(json: ApiResponse<unknown> | null, fallback: string): string {
  if (json && !json.ok) return json.error.message;
  return fallback;
}

type Course = { id: string; name: string; workloadHours: number | null };
type Teacher = { id: string; name: string };

type Cycle = {
  id: string;
  cycle: number;
  year: number;
  isVisibleForEnrollments: boolean;
};

type ClassGroup = {
  id: string;
  cycleId: string;
  courseId: string;
  teacherId: string;
  teacherIds?: string[];
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
  poloLocationId?: string | null;
  poloLocation?: {
    id: string;
    name: string;
    polo: { id: string; name: string };
  } | null;
  createdAt: string;
  cycle: Cycle;
  course: Course;
  teacher: Teacher;
  teachers?: Teacher[];
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

const STATUS_SHORT: Record<ClassGroup["status"], string> = {
  PLANEJADA: "Plan.",
  ABERTA: "Abert.",
  EM_ANDAMENTO: "And.",
  ENCERRADA: "Enc.",
  CANCELADA: "Canc.",
  INTERNO: "Int.",
  EXTERNO: "Ext.",
};

/** Início no formato dd/mm/aa */
function formatStartDateShort(d: string | undefined): string {
  if (!d) return "—";
  const datePart = String(d).trim().split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "—";
  const [y, m, day] = datePart.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

/** Horário compacto: 09:00–10:15 → 9/10:15 */
function formatTimeShort(startTime: string, endTime: string): string {
  const fmt = (t: string) => {
    const s = (t ?? "").trim().slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(s)) return s || "—";
    const [h, min] = s.split(":");
    const hh = String(parseInt(h, 10));
    return min === "00" ? hh : `${hh}:${min}`;
  };
  return `${fmt(startTime)}/${fmt(endTime)}`;
}

function formatTeachersShort(cg: ClassGroup): string {
  const names =
    cg.teachers && cg.teachers.length > 0
      ? cg.teachers.map((t) => t.name)
      : [cg.teacher.name];
  return names
    .map((n) => n.trim().split(/\s+/)[0] || n)
    .filter(Boolean)
    .join(", ");
}

async function downloadBlobResponse(res: Response, fallbackName: string) {
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(cd);
  const fileName = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ClassGroupsPage() {
  const toast = useToast();
  const user = useUser();
  const canMutate = user.role === "MASTER" || user.role === "ADMIN" || user.role === "COORDINATOR";
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ClassGroup[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  const [open, setOpen] = useState(false);
  const [openCycle, setOpenCycle] = useState(false);
  const [openCycleEdit, setOpenCycleEdit] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<ClassGroup["status"][]>([]);
  const [editing, setEditing] = useState<ClassGroup | null>(null);

  const [cycleId, setCycleId] = useState(DEFAULT_CYCLE_ID);
  const [courseId, setCourseId] = useState("");
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(["TER", "QUI"]);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [capacity, setCapacity] = useState("20");
  const [status, setStatus] = useState<ClassGroup["status"]>("PLANEJADA");
  const [location, setLocation] = useState("");
  const [poloLocationId, setPoloLocationId] = useState("");
  const [poloLocationOptions, setPoloLocationOptions] = useState<
    Array<{ id: string; label: string; name: string }>
  >([]);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState("");

  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [saving, setSaving] = useState(false);

  const [cycleNumber, setCycleNumber] = useState("1");
  const [cycleYear, setCycleYear] = useState(String(new Date().getFullYear()));
  const [cycleVisible, setCycleVisible] = useState(true);
  const [cycleSaving, setCycleSaving] = useState(false);
  const [downloadingCertsId, setDownloadingCertsId] = useState<string | null>(null);
  const [downloadingCycleCertsId, setDownloadingCycleCertsId] = useState<string | null>(null);
  const [downloadingSelected, setDownloadingSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionsMenuId, setActionsMenuId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  const [cycleEditNumber, setCycleEditNumber] = useState("1");
  const [cycleEditYear, setCycleEditYear] = useState(String(new Date().getFullYear()));
  const [cycleEditVisible, setCycleEditVisible] = useState(true);

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
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId),
    [courses, courseId],
  );
  const courseHasWorkload = selectedCourse != null && (selectedCourse.workloadHours ?? 0) > 0;

  const canSubmit = useMemo(() => {
    const base =
      courseId.length > 0 &&
      teacherIds.length > 0 &&
      daysOfWeek.length > 0 &&
      startDate.trim().length > 0 &&
      startTime.trim().length > 0 &&
      endTime.trim().length > 0 &&
      Number(capacity) > 0;
    return base && (editing != null || courseHasWorkload);
  }, [courseId, teacherIds, daysOfWeek, startDate, startTime, endTime, capacity, courseHasWorkload, editing]);

  function toggleTeacher(id: string) {
    setTeacherIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function resetForm() {
    setCycleId(DEFAULT_CYCLE_ID);
    setCourseId("");
    setTeacherIds([]);
    setDaysOfWeek(["TER", "QUI"]);
    setStartDate("");
    setStartTime("08:00");
    setEndTime("10:00");
    setCapacity("20");
    setStatus("PLANEJADA");
    setLocation("");
    setPoloLocationId("");
    setSelectedTimeSlotId("");
    setEditing(null);
    setSessions([]);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEditCycle(c: Cycle) {
    setEditingCycle(c);
    setCycleEditNumber(String(c.cycle));
    setCycleEditYear(String(c.year));
    setCycleEditVisible(!!c.isVisibleForEnrollments);
    setOpenCycleEdit(true);
  }

  function openEdit(cg: ClassGroup) {
    setEditing(cg);
    setCycleId(cg.cycleId);
    setCourseId(cg.courseId);
    setTeacherIds(
      cg.teacherIds && cg.teacherIds.length > 0
        ? cg.teacherIds
        : cg.teachers && cg.teachers.length > 0
          ? cg.teachers.map((t) => t.id)
          : [cg.teacherId]
    );
    setDaysOfWeek(cg.daysOfWeek);
    setStartDate(cg.startDate ? String(cg.startDate).slice(0, 10) : "");
    setStartTime(cg.startTime);
    setEndTime(cg.endTime);
    setCapacity(String(cg.capacity));
    setStatus(cg.status);
    setLocation(cg.location ?? "");
    setPoloLocationId(cg.poloLocationId ?? cg.poloLocation?.id ?? "");
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
      const [cgRes, cyclesRes, cRes, tRes, tsRes, polosRes] = await Promise.all([
        fetch("/api/class-groups"),
        fetch("/api/cycles"),
        fetch("/api/courses"),
        fetch("/api/teachers"),
        fetch("/api/time-slots?activeOnly=true"),
        fetch("/api/admin/polos"),
      ]);

      const [cgJson, cyclesJson, cJson, tJson, tsJson, polosJson] = await Promise.all([
        parseJsonSafe<{ classGroups: ClassGroup[] }>(cgRes),
        parseJsonSafe<{ cycles: Cycle[] }>(cyclesRes),
        parseJsonSafe<{ courses: Course[] }>(cRes),
        parseJsonSafe<{ teachers: Teacher[] }>(tRes),
        parseJsonSafe<{ timeSlots: TimeSlot[] }>(tsRes),
        parseJsonSafe<{
          polos: Array<{
            name: string;
            isActive: boolean;
            locations: Array<{ id: string; name: string; isActive: boolean }>;
          }>;
        }>(polosRes),
      ]);

      if (!cgRes.ok || !cgJson?.ok)
        throw new Error(cgJson && "error" in cgJson ? cgJson.error.message : "Falha ao carregar turmas.");
      if (!cRes.ok || !cJson?.ok)
        throw new Error(cJson && "error" in cJson ? cJson.error.message : "Falha ao carregar cursos.");
      if (!tRes.ok || !tJson?.ok)
        throw new Error(tJson && "error" in tJson ? tJson.error.message : "Falha ao carregar professores.");

      setItems(cgJson!.data.classGroups);
      setCycles(cyclesJson?.ok ? cyclesJson.data.cycles : []);
      setCourses(cJson!.data.courses);
      setTeachers(tJson!.data.teachers);
      setTimeSlots(tsJson?.ok ? tsJson.data.timeSlots : []);
      if (polosJson?.ok) {
        const opts: Array<{ id: string; label: string; name: string }> = [];
        for (const p of polosJson.data.polos.filter((x) => x.isActive)) {
          for (const loc of p.locations.filter((l) => l.isActive)) {
            opts.push({ id: loc.id, label: `${p.name} — ${loc.name}`, name: loc.name });
          }
        }
        setPoloLocationOptions(opts);
      } else {
        setPoloLocationOptions([]);
      }
    } catch (e: unknown) {
      toast.push("error", e instanceof Error ? e.message : "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshClassGroupsList() {
    try {
      const cgRes = await fetch("/api/class-groups");
      const cgJson = await parseJsonSafe<{ classGroups: ClassGroup[] }>(cgRes);
      if (!cgRes.ok || !cgJson?.ok) return;
      setItems(cgJson.data.classGroups);
    } catch {
      /* lista já atualizada pelo modal */
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
        cycleId,
        courseId,
        teacherIds,
        daysOfWeek,
        startDate,
        startTime,
        endTime,
        capacity: Number(capacity),
        status,
        location,
        poloLocationId: poloLocationId || null,
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

  async function duplicateClassGroup(cg: ClassGroup) {
    if (duplicatingId) return;
    setDuplicatingId(cg.id);
    try {
      const res = await fetch(`/api/class-groups/${cg.id}/duplicate`, { method: "POST" });
      const json = await parseJsonSafe<{ classGroup: ClassGroup }>(res);
      if (!res.ok || !json?.ok) {
        toast.push("error", apiErrorMessage(json, "Falha ao duplicar turma."));
        return;
      }
      toast.push("success", "Turma duplicada.");
      openEdit(json.data.classGroup);
      void refreshClassGroupsList();
    } finally {
      setDuplicatingId(null);
    }
  }

  async function downloadClassGroupCertificates(cg: ClassGroup) {
    if (downloadingCertsId) return;
    setDownloadingCertsId(cg.id);
    setActionsMenuId(null);
    try {
      const res = await fetch(`/api/class-groups/${cg.id}/certificates-zip`, {
        credentials: "include",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
        toast.push("error", apiErrorMessage(json, "Falha ao baixar certificados."));
        return;
      }
      await downloadBlobResponse(res, `certificados-${cg.id.slice(0, 8)}.zip`);
      toast.push("success", "Download dos certificados iniciado.");
    } catch {
      toast.push("error", "Falha ao baixar certificados.");
    } finally {
      setDownloadingCertsId(null);
    }
  }

  async function downloadSelectedCertificates() {
    const ids = [...selectedIds];
    if (ids.length === 0 || downloadingSelected) return;
    setDownloadingSelected(true);
    try {
      const res = await fetch("/api/class-groups/certificates-zip", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classGroupIds: ids }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
        toast.push("error", apiErrorMessage(json, "Falha ao baixar certificados selecionados."));
        return;
      }
      await downloadBlobResponse(res, `certificados-selecionadas-${ids.length}-turmas.zip`);
      toast.push("success", "Download dos certificados selecionados iniciado.");
    } catch {
      toast.push("error", "Falha ao baixar certificados selecionados.");
    } finally {
      setDownloadingSelected(false);
    }
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!actionsMenuRef.current) return;
      if (!actionsMenuRef.current.contains(e.target as Node)) {
        setActionsMenuId(null);
      }
    }
    if (actionsMenuId) {
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }
  }, [actionsMenuId]);

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
        description={
          canMutate
            ? "Todas as turmas do sistema. Pesquise por curso, data de início ou horário e filtre por status."
            : "Todas as turmas do sistema (consulta). Pesquise por curso, data de início ou horário e filtre por status."
        }
        rightSlot={
          canMutate ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="secondary" onClick={() => setOpenCycle(true)} className="w-full sm:w-auto">
                Novo ciclo
              </Button>
              <Button onClick={openCreate} className="w-full sm:w-auto">
                Nova turma
              </Button>
            </div>
          ) : undefined
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
        title="Ciclos"
        description="Gerencie os ciclos (número, ano e visibilidade para matrículas no painel e no site)."
      >
        <TableShell>
          <thead>
            <tr>
              <Th>Ciclo</Th>
              <Th>Ano</Th>
              <Th>Visível p/ matrículas</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.id}>
                <Td className="whitespace-nowrap text-[var(--text-secondary)]">{c.cycle}</Td>
                <Td className="whitespace-nowrap text-[var(--text-secondary)]">{c.year}</Td>
                <Td className="whitespace-nowrap">
                  <Badge tone={c.isVisibleForEnrollments ? "green" : "zinc"}>
                    {c.isVisibleForEnrollments ? "Sim" : "Não"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="secondary"
                      disabled={downloadingCycleCertsId != null}
                      title="Baixar ZIP com certificados de todas as turmas deste ciclo"
                      onClick={async () => {
                        if (downloadingCycleCertsId) return;
                        setDownloadingCycleCertsId(c.id);
                        try {
                          const res = await fetch(`/api/cycles/${c.id}/certificates-zip`, {
                            credentials: "include",
                          });
                          if (!res.ok) {
                            const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
                            toast.push(
                              "error",
                              apiErrorMessage(json, "Falha ao baixar certificados do ciclo."),
                            );
                            return;
                          }
                          await downloadBlobResponse(
                            res,
                            `certificados-ciclo-${c.cycle}-${c.year}.zip`,
                          );
                          toast.push("success", "Download dos certificados do ciclo iniciado.");
                        } catch {
                          toast.push("error", "Falha ao baixar certificados do ciclo.");
                        } finally {
                          setDownloadingCycleCertsId(null);
                        }
                      }}
                    >
                      {downloadingCycleCertsId === c.id ? "Gerando ZIP…" : "Baixar certificados"}
                    </Button>
                    <Button variant="secondary" onClick={() => openEditCycle(c)}>
                      Editar
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        if (!canMutate) return;
                        try {
                          const res = await fetch(`/api/cycles/${c.id}`, {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ isVisibleForEnrollments: !c.isVisibleForEnrollments }),
                          });
                          const json = await parseJsonSafe<{ cycle: Cycle }>(res);
                          if (!res.ok || !json?.ok) {
                            toast.push("error", apiErrorMessage(json, "Falha ao atualizar ciclo."));
                            return;
                          }
                          toast.push("success", "Ciclo atualizado.");
                          await loadAll();
                        } catch {
                          toast.push("error", "Falha ao atualizar ciclo.");
                        }
                      }}
                    >
                      {c.isVisibleForEnrollments ? "Ocultar" : "Exibir"}
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {cycles.length === 0 ? (
              <tr>
                <Td colSpan={4}>
                  <span className="text-[var(--text-secondary)]">Nenhum ciclo cadastrado.</span>
                </Td>
              </tr>
            ) : null}
          </tbody>
        </TableShell>
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
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={selectedIds.size === 0 || downloadingSelected}
                onClick={() => void downloadSelectedCertificates()}
              >
                {downloadingSelected
                  ? "Gerando ZIP…"
                  : `Baixar certificados (${selectedIds.size})`}
              </Button>
              {selectedIds.size > 0 ? (
                <button
                  type="button"
                  className="text-xs text-[var(--text-muted)] underline hover:text-[var(--text-primary)]"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Limpar seleção
                </button>
              ) : null}
            </div>
            <TableShell>
              <thead>
                <tr>
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas as turmas visíveis"
                      checked={
                        visibleItems.length > 0 &&
                        visibleItems.every((cg) => selectedIds.has(cg.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(visibleItems.map((cg) => cg.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                    />
                  </Th>
                  <Th>Ciclo</Th>
                  <Th>Curso</Th>
                  <Th>Prof.</Th>
                  <Th>In.</Th>
                  <Th>Hr.</Th>
                  <Th>Status</Th>
                  <Th>Cap.</Th>
                  <Th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((cg) => {
                  const menuOpen = actionsMenuId === cg.id;
                  return (
                    <tr key={cg.id}>
                      <Td>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar turma ${cg.course.name}`}
                          checked={selectedIds.has(cg.id)}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(cg.id);
                              else next.delete(cg.id);
                              return next;
                            });
                          }}
                        />
                      </Td>
                      <Td className="whitespace-nowrap text-[var(--text-secondary)]">
                        {cg.cycle ? `${cg.cycle.cycle}/${String(cg.cycle.year).slice(2)}` : "—"}
                      </Td>
                      <Td
                        className="max-w-[12rem] truncate font-medium text-[var(--text-primary)]"
                        title={cg.course.name}
                      >
                        {cg.course.name}
                      </Td>
                      <Td
                        className="max-w-[7rem] truncate text-[var(--text-secondary)]"
                        title={
                          (cg.teachers && cg.teachers.length > 0
                            ? cg.teachers.map((t) => t.name)
                            : [cg.teacher.name]
                          ).join(", ")
                        }
                      >
                        {formatTeachersShort(cg)}
                      </Td>
                      <Td className="whitespace-nowrap text-[var(--text-secondary)]">
                        {formatStartDateShort(cg.startDate)}
                      </Td>
                      <Td
                        className="whitespace-nowrap text-[var(--text-secondary)]"
                        title={`${cg.startTime} – ${cg.endTime}`}
                      >
                        {formatTimeShort(cg.startTime, cg.endTime)}
                      </Td>
                      <Td>
                        <span title={cg.status}>
                          <Badge tone={STATUS_TONE[cg.status]}>{STATUS_SHORT[cg.status]}</Badge>
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-[var(--text-secondary)]">
                        {cg.enrollmentsCount ?? 0}/{cg.capacity}
                      </Td>
                      <Td className="relative text-right">
                        <div
                          className="relative inline-block text-left"
                          ref={menuOpen ? actionsMenuRef : undefined}
                        >
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            onClick={() =>
                              setActionsMenuId((prev) => (prev === cg.id ? null : cg.id))
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Ações</span>
                          </Button>
                          {menuOpen ? (
                            <div
                              role="menu"
                              className="absolute right-0 z-30 mt-1 min-w-[11rem] rounded-md border border-[var(--card-border)] bg-white py-1 shadow-lg dark:bg-zinc-900"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)] disabled:opacity-50"
                                disabled={
                                  downloadingCertsId != null || (cg.enrollmentsCount ?? 0) === 0
                                }
                                onClick={() => void downloadClassGroupCertificates(cg)}
                              >
                                {downloadingCertsId === cg.id
                                  ? "Gerando ZIP…"
                                  : "Baixar certificados"}
                              </button>
                              {canMutate ? (
                                <>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="block w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                                    onClick={() => {
                                      setActionsMenuId(null);
                                      openEdit(cg);
                                    }}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="block w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)] disabled:opacity-50"
                                    disabled={duplicatingId != null}
                                    onClick={() => {
                                      setActionsMenuId(null);
                                      void duplicateClassGroup(cg);
                                    }}
                                  >
                                    {duplicatingId === cg.id ? "Duplicando…" : "Duplicar"}
                                  </button>
                                  {cg.status !== "CANCELADA" ? (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-[var(--igh-surface)]"
                                      onClick={() => {
                                        setActionsMenuId(null);
                                        void inactivateClassGroup(cg);
                                      }}
                                    >
                                      Inativar
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="block w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                                        onClick={() => {
                                          setActionsMenuId(null);
                                          void reactivateClassGroup(cg);
                                        }}
                                      >
                                        Reativar
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-[var(--igh-surface)]"
                                        onClick={() => {
                                          setActionsMenuId(null);
                                          void deleteClassGroup(cg);
                                        }}
                                      >
                                        Excluir
                                      </button>
                                    </>
                                  )}
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
                {visibleItems.length === 0 ? (
                  <tr>
                    <Td colSpan={9}>
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
          </>
        )}
      </SectionCard>

      <Modal
        open={openCycleEdit}
        title={editingCycle ? `Editar ciclo ${editingCycle.cycle}/${editingCycle.year}` : "Editar ciclo"}
        onClose={() => { setOpenCycleEdit(false); setEditingCycle(null); }}
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!canMutate || cycleSaving || !editingCycle) return;
            setCycleSaving(true);
            try {
              const payload = {
                cycle: Number(cycleEditNumber),
                year: Number(cycleEditYear),
                isVisibleForEnrollments: cycleEditVisible,
              };
              const res = await fetch(`/api/cycles/${editingCycle.id}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
              });
              const json = await parseJsonSafe<{ cycle: Cycle }>(res);
              if (!res.ok || !json?.ok) {
                toast.push("error", apiErrorMessage(json, "Falha ao atualizar ciclo."));
                return;
              }
              toast.push("success", "Ciclo atualizado.");
              setOpenCycleEdit(false);
              setEditingCycle(null);
              await loadAll();
            } finally {
              setCycleSaving(false);
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Ciclo</label>
              <div className="mt-1">
                <Input value={cycleEditNumber} onChange={(e) => setCycleEditNumber(e.target.value)} inputMode="numeric" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Ano</label>
              <div className="mt-1">
                <Input value={cycleEditYear} onChange={(e) => setCycleEditYear(e.target.value)} inputMode="numeric" />
              </div>
            </div>
          </div>
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cycleEditVisible}
              onChange={(e) => setCycleEditVisible(e.target.checked)}
            />
            Visível para matrículas (painel e site)
          </label>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setOpenCycleEdit(false); setEditingCycle(null); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={cycleSaving}>
              {cycleSaving ? "Salvando" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={openCycle} title="Novo ciclo" onClose={() => setOpenCycle(false)}>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!canMutate || cycleSaving) return;
            setCycleSaving(true);
            try {
              const payload = {
                cycle: Number(cycleNumber),
                year: Number(cycleYear),
                isVisibleForEnrollments: cycleVisible,
              };
              const res = await fetch("/api/cycles", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
              });
              const json = await parseJsonSafe<{ cycle: Cycle }>(res);
              if (!res.ok || !json?.ok) {
                toast.push("error", apiErrorMessage(json, "Falha ao criar ciclo."));
                return;
              }
              toast.push("success", "Ciclo criado.");
              setOpenCycle(false);
              await loadAll();
            } finally {
              setCycleSaving(false);
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Ciclo</label>
              <div className="mt-1">
                <Input value={cycleNumber} onChange={(e) => setCycleNumber(e.target.value)} inputMode="numeric" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Ano</label>
              <div className="mt-1">
                <Input value={cycleYear} onChange={(e) => setCycleYear(e.target.value)} inputMode="numeric" />
              </div>
            </div>
          </div>
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cycleVisible}
              onChange={(e) => setCycleVisible(e.target.checked)}
            />
            Visível para matrículas (painel e site)
          </label>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpenCycle(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={cycleSaving}>
              {cycleSaving ? "Salvando" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={open}
        title={editing ? "Editar turma" : "Nova turma"}
        onClose={() => { setOpen(false); resetForm(); }}
      >
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Ciclo</label>
            <div className="mt-1">
              <select
                className="theme-input h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)]"
                value={cycleId}
                onChange={(e) => setCycleId(e.target.value)}
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`Ciclo ${c.cycle} / ${c.year}`}{c.isVisibleForEnrollments ? "" : " (oculto)"}
                  </option>
                ))}
                {cycles.length === 0 ? <option value={DEFAULT_CYCLE_ID}>Ciclo 1 / 2026</option> : null}
              </select>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Só ciclos marcados como visíveis aparecem para matrículas no painel e no site.
              </p>
            </div>
          </div>
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
            <label className="text-sm font-medium">Professor(es)</label>
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-md border border-[var(--card-border)] p-3">
              {teachers.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">Nenhum professor cadastrado.</p>
              ) : (
                teachers.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={teacherIds.includes(t.id)}
                      onChange={() => toggleTeacher(t.id)}
                      className="h-4 w-4 rounded border-[var(--card-border)] text-[var(--igh-primary)] focus:ring-[var(--igh-primary)]"
                    />
                    {t.name}
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Selecione um ou mais professores responsáveis pela turma.
            </p>
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
            <label className="text-sm font-medium">Polo / Local (recomendado)</label>
            <div className="mt-1">
              <select
                className="theme-input h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)]"
                value={poloLocationId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPoloLocationId(id);
                  const opt = poloLocationOptions.find((o) => o.id === id);
                  if (opt) setLocation(opt.name);
                }}
              >
                <option value="">Sem vínculo a polo</option>
                {poloLocationOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Vincule a turma a um local cadastrado em Administração → Polos para o coordenador do polo gerenciar as matrículas.
            </p>
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
                      aria-selected={false}
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
