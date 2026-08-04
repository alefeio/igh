"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { StudentForm } from "@/components/students/StudentForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ApiResponse } from "@/lib/api-types";
import { formatDateOnly, formatDateTime } from "@/lib/format";
import { formatEnrollmentClassGroupOptionLabel } from "@/lib/turma-display";

type StudentOpt = { id: string; name: string; email: string | null };
type ClassGroupOpt = {
  id: string;
  capacity?: number;
  enrollmentsCount?: number;
  startDate: string;
  startTime: string;
  endTime: string;
  daysOfWeek?: string[];
  location?: string | null;
  status?: string;
  course: { name: string };
};

type WaitlistRow = {
  id: string;
  position: number;
  createdAt: string;
  student: { id: string; name: string; email: string | null; phone: string };
  classGroup: {
    id: string;
    course: { name: string };
    startDate: string;
    startTime: string;
    endTime: string;
    capacity: number;
    activeEnrollments: number;
  };
};

function isClassGroupFull(cg: ClassGroupOpt): boolean {
  const cap = cg.capacity ?? 0;
  const count = cg.enrollmentsCount ?? 0;
  return cap > 0 && count >= cap;
}

export function EnrollmentWaitlistPanel({
  canManage,
  classGroups,
  onNeedClassGroups,
  reloadToken = 0,
  isMaster = false,
  canRemove = false,
}: {
  canManage: boolean;
  classGroups: ClassGroupOpt[];
  onNeedClassGroups: () => void | Promise<void>;
  /** Incrementa para forçar reload (ex.: após excluir/cancelar matrícula). */
  reloadToken?: number;
  isMaster?: boolean;
  /** Somente Master (papel exato) pode remover reservas. */
  canRemove?: boolean;
}) {
  const toast = useToast();
  const [items, setItems] = useState<WaitlistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [openNewStudent, setOpenNewStudent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [studentId, setStudentId] = useState("");
  const [classGroupId, setClassGroupId] = useState("");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const studentComboboxRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<number | null>(null);

  const fullClassGroups = useMemo(() => classGroups.filter(isClassGroupFull), [classGroups]);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const res = await fetch("/api/enrollments/waitlist");
      const json = (await res.json()) as ApiResponse<{ waitlist: WaitlistRow[] }>;
      if (res.ok && json?.ok) setItems(json.data.waitlist ?? []);
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  async function searchStudents(q: string) {
    const params = new URLSearchParams({ pageSize: "20", q });
    const res = await fetch(`/api/students?${params}`);
    const json = (await res.json()) as ApiResponse<{ students: StudentOpt[] }>;
    if (res.ok && json?.ok) setStudents(json.data.students ?? []);
  }

  useEffect(() => {
    if (!open) return;
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => {
      void searchStudents(studentSearchQuery);
    }, 250);
    return () => {
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    };
  }, [studentSearchQuery, open]);

  useEffect(() => {
    if (classGroupId && !fullClassGroups.some((cg) => cg.id === classGroupId)) {
      setClassGroupId("");
    }
  }, [classGroupId, fullClassGroups]);

  function openCreate() {
    setStudentId("");
    setClassGroupId("");
    setStudentSearchQuery("");
    setStudentDropdownOpen(false);
    setOpen(true);
    void onNeedClassGroups();
    void searchStudents("");
  }

  function handleNewStudentSuccess(student: { id: string; name: string; email: string | null }) {
    setOpenNewStudent(false);
    setStudents((prev) => (prev.some((s) => s.id === student.id) ? prev : [...prev, student]));
    setStudentId(student.id);
    setStudentSearchQuery("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !classGroupId || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/enrollments/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, classGroupId }),
      });
      const json = (await res.json()) as ApiResponse<{ waitlist: { id: string } }>;
      if (!res.ok || !json?.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao criar reserva.");
        return;
      }
      toast.push(
        "success",
        "Cadastro de reserva criado. O aluno será matriculado automaticamente quando houver vaga.",
      );
      setOpen(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelEntry(id: string, studentName: string) {
    if (!confirm(`Remover a reserva de ${studentName} da lista de espera?`)) return;
    const res = await fetch(`/api/enrollments/waitlist/${id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ cancelled?: boolean }>;
    if (!res.ok || !json?.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao cancelar reserva.");
      return;
    }
    toast.push("success", "Reserva removida da lista de espera.");
    await load();
  }

  if (!canManage) return null;

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={openCreate}>
          Cadastro de reserva
        </Button>
      </div>

      <SectionCard
        title="Lista de espera (reservas)"
        description={
          loading
            ? "Carregando reservas…"
            : items.length === 0
              ? "Nenhuma reserva aguardando vaga. Use «Cadastro de reserva» para turmas lotadas."
              : `${items.length} reserva(s) na fila. A primeira de cada turma é matriculada automaticamente quando uma vaga é liberada (cancelamento ou exclusão).`
        }
        variant="elevated"
      >
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] text-[var(--text-muted)]">
                  <th className="px-2 py-2 font-medium">Fila</th>
                  <th className="px-2 py-2 font-medium">Aluno</th>
                  <th className="px-2 py-2 font-medium">Turma</th>
                  <th className="px-2 py-2 font-medium">Vagas</th>
                  <th className="px-2 py-2 font-medium">Desde</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((w) => (
                  <tr key={w.id} className="border-b border-[var(--card-border)]/60">
                    <td className="px-2 py-2">{w.position}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{w.student.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {w.student.email ?? w.student.phone}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      {w.classGroup.course.name}
                      <div className="text-xs text-[var(--text-muted)]">
                        {formatDateOnly(w.classGroup.startDate)} · {w.classGroup.startTime}–
                        {w.classGroup.endTime}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      {w.classGroup.activeEnrollments}/{w.classGroup.capacity}
                    </td>
                    <td className="px-2 py-2 text-xs text-[var(--text-muted)]">
                      {formatDateTime(w.createdAt)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {canRemove ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-red-600"
                          onClick={() => cancelEntry(w.id, w.student.name)}
                        >
                          Remover
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>

      <Modal open={open} title="Cadastro de reserva" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            Para turmas sem vagas. O aluno precisa estar cadastrado. Ao cancelar ou excluir uma
            matrícula, o primeiro da fila é matriculado e recebe o e-mail de acesso.
          </p>
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium">Aluno</label>
            <Button type="button" variant="secondary" onClick={() => setOpenNewStudent(true)}>
              Cadastrar aluno
            </Button>
          </div>
          <div ref={studentComboboxRef} className="relative">
            <input
              type="text"
              value={
                studentId
                  ? (() => {
                      const s = students.find((x) => x.id === studentId);
                      return s
                        ? `${s.name}${s.email ? ` (${s.email})` : " (sem e-mail)"}`
                        : studentSearchQuery;
                    })()
                  : studentSearchQuery
              }
              onChange={(e) => {
                setStudentSearchQuery(e.target.value);
                setStudentId("");
                setStudentDropdownOpen(true);
              }}
              onFocus={() => setStudentDropdownOpen(true)}
              onBlur={() => setTimeout(() => setStudentDropdownOpen(false), 150)}
              placeholder="Digite o nome ou e-mail do aluno..."
              className="theme-input w-full rounded border px-3 py-2 text-sm"
              autoComplete="off"
            />
            {studentDropdownOpen ? (
              <ul
                className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-[var(--card-border)] bg-[var(--card-bg)] py-1 shadow-lg"
                role="listbox"
              >
                {students.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[var(--text-muted)]">
                    Nenhum aluno encontrado. Use «Cadastrar aluno» se ainda não existir.
                  </li>
                ) : (
                  students.map((s) => (
                    <li
                      key={s.id}
                      role="option"
                      aria-selected={false}
                      className="cursor-pointer px-3 py-2 text-sm hover:bg-[var(--igh-surface)]"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setStudentId(s.id);
                        setStudentSearchQuery("");
                        setStudentDropdownOpen(false);
                      }}
                    >
                      {`${s.name}${s.email ? ` (${s.email})` : " (sem e-mail)"}`}
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
          <div>
            <label className="text-sm font-medium">Turma (lotada)</label>
            <select
              value={classGroupId}
              onChange={(e) => setClassGroupId(e.target.value)}
              className="theme-input mt-1 w-full rounded border px-3 py-2 text-sm"
              required
            >
              <option value="">
                {fullClassGroups.length === 0 ? "Nenhuma turma lotada no momento" : "Selecione"}
              </option>
              {fullClassGroups.map((cg) => (
                <option key={cg.id} value={cg.id}>
                  {formatEnrollmentClassGroupOptionLabel(cg, formatDateOnly)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Só aparecem turmas sem vagas disponíveis.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || !studentId || !classGroupId || fullClassGroups.length === 0}
            >
              {submitting ? "Salvando…" : "Criar reserva"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={openNewStudent} title="Cadastrar aluno" onClose={() => setOpenNewStudent(false)}>
        <StudentForm
          editing={null}
          onSuccess={handleNewStudentSuccess}
          onCancel={() => setOpenNewStudent(false)}
          isMaster={isMaster}
        />
      </Modal>
    </>
  );
}
