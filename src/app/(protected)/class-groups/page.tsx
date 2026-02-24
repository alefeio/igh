"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Course = { id: string; name: string };
type Teacher = { id: string; name: string };

type ClassGroup = {
  id: string;
  courseId: string;
  teacherId: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  capacity: number;
  status: "PLANEJADA" | "ABERTA" | "EM_ANDAMENTO" | "ENCERRADA" | "CANCELADA";
  location: string | null;
  createdAt: string;
  course: Course;
  teacher: Teacher;
};

const STATUS_TONE: Record<ClassGroup["status"], Parameters<typeof Badge>[0]["tone"]> = {
  PLANEJADA: "zinc",
  ABERTA: "blue",
  EM_ANDAMENTO: "amber",
  ENCERRADA: "green",
  CANCELADA: "red",
};

export default function ClassGroupsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ClassGroup[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassGroup | null>(null);

  const [courseId, setCourseId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(["SEG", "QUA"]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [capacity, setCapacity] = useState("20");
  const [status, setStatus] = useState<ClassGroup["status"]>("PLANEJADA");
  const [location, setLocation] = useState("");

  const canSubmit = useMemo(() => {
    return (
      courseId.length > 0 &&
      teacherId.length > 0 &&
      daysOfWeek.length > 0 &&
      startTime.trim().length > 0 &&
      endTime.trim().length > 0 &&
      Number(capacity) > 0
    );
  }, [courseId, teacherId, daysOfWeek, startTime, endTime, capacity]);

  function resetForm() {
    setCourseId("");
    setTeacherId("");
    setDaysOfWeek(["SEG", "QUA"]);
    setStartTime("08:00");
    setEndTime("10:00");
    setCapacity("20");
    setStatus("PLANEJADA");
    setLocation("");
    setEditing(null);
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
    setStartTime(cg.startTime);
    setEndTime(cg.endTime);
    setCapacity(String(cg.capacity));
    setStatus(cg.status);
    setLocation(cg.location ?? "");
    setOpen(true);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [cgRes, cRes, tRes] = await Promise.all([
        fetch("/api/class-groups"),
        fetch("/api/courses"),
        fetch("/api/teachers"),
      ]);

      const [cgJson, cJson, tJson] = (await Promise.all([
        cgRes.json(),
        cRes.json(),
        tRes.json(),
      ])) as [
        ApiResponse<{ classGroups: ClassGroup[] }>,
        ApiResponse<{ courses: Course[] }>,
        ApiResponse<{ teachers: Teacher[] }>,
      ];

      if (!cgRes.ok || !cgJson.ok)
        throw new Error(!cgJson.ok ? cgJson.error.message : "Falha ao carregar turmas.");
      if (!cRes.ok || !cJson.ok)
        throw new Error(!cJson.ok ? cJson.error.message : "Falha ao carregar cursos.");
      if (!tRes.ok || !tJson.ok)
        throw new Error(!tJson.ok ? tJson.error.message : "Falha ao carregar professores.");

      setItems(cgJson.data.classGroups);
      setCourses(cJson.data.courses);
      setTeachers(tJson.data.teachers);
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
    if (!canSubmit) return;

    const payload = {
      courseId,
      teacherId,
      daysOfWeek,
      startTime,
      endTime,
      capacity: Number(capacity),
      status,
      location,
    };

    const url = editing ? `/api/class-groups/${editing.id}` : "/api/class-groups";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as ApiResponse<{ classGroup: { id: string } }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao salvar turma.");
      return;
    }
    toast.push("success", editing ? "Turma atualizada." : "Turma criada.");
    setOpen(false);
    resetForm();
    await loadAll();
  }

  function toggleDay(day: string) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Turmas</div>
          <div className="text-sm text-zinc-600">Turma pertence a um curso e tem 1 professor.</div>
        </div>
        <Button onClick={openCreate}>Nova</Button>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-600">Carregando...</div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Turma</Th>
              <Th>Horário</Th>
              <Th>Status</Th>
              <Th>Capacidade</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.map((cg) => (
              <tr key={cg.id}>
                <Td>
                  <div className="flex flex-col">
                    <span className="font-medium text-zinc-900">{cg.course.name}</span>
                    <span className="text-xs text-zinc-500">
                      Prof: {cg.teacher.name} · {cg.daysOfWeek.join(", ")} · {cg.location ?? "—"}
                    </span>
                  </div>
                </Td>
                <Td>
                  {cg.startTime} - {cg.endTime}
                </Td>
                <Td>
                  <Badge tone={STATUS_TONE[cg.status]}>{cg.status}</Badge>
                </Td>
                <Td>{cg.capacity}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openEdit(cg)}>
                      Editar
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <Td>
                  <span className="text-zinc-600">Nenhuma turma cadastrada.</span>
                </Td>
                <Td />
                <Td />
                <Td />
                <Td />
              </tr>
            ) : null}
          </tbody>
        </Table>
      )}

      <Modal
        open={open}
        title={editing ? "Editar turma" : "Nova turma"}
        onClose={() => setOpen(false)}
      >
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Curso</label>
            <div className="mt-1">
              <select
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Professor</label>
            <div className="mt-1">
              <select
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
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
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Início</label>
              <div className="mt-1">
                <Input value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Fim</label>
              <div className="mt-1">
                <Input value={endTime} onChange={(e) => setEndTime(e.target.value)} />
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
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ClassGroup["status"])}
                >
                  <option value="PLANEJADA">PLANEJADA</option>
                  <option value="ABERTA">ABERTA</option>
                  <option value="EM_ANDAMENTO">EM_ANDAMENTO</option>
                  <option value="ENCERRADA">ENCERRADA</option>
                  <option value="CANCELADA">CANCELADA</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Local/Sala (opcional)</label>
            <div className="mt-1">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
