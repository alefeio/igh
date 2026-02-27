"use client";

import { useCallback, useEffect, useState } from "react";

import { StudentForm } from "@/components/students/StudentForm";
import type { StudentFormStudent } from "@/components/students/StudentForm";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

const STUDY_SHIFT_LABELS: Record<string, string> = {
  MORNING: "Manhã",
  AFTERNOON: "Tarde",
  EVENING: "Noite",
  FULL: "Integral",
};

const EDUCATION_LEVEL_LABELS: Record<string, string> = {
  NONE: "Nenhuma",
  ELEMENTARY_INCOMPLETE: "Fundamental incompleto",
  ELEMENTARY_COMPLETE: "Fundamental completo",
  HIGH_INCOMPLETE: "Médio incompleto",
  HIGH_COMPLETE: "Médio completo",
  COLLEGE_INCOMPLETE: "Superior incompleto",
  COLLEGE_COMPLETE: "Superior completo",
  OTHER: "Outro",
};

function formatCpf(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

type Student = StudentFormStudent & {
  deletedAt: string | null;
  createdAt: string;
};

export default function StudentsPage() {
  const toast = useToast();
  const user = useUser();
  const isMaster = user.role === "MASTER";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Student[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [q, setQ] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (isMaster && includeDeleted) params.set("includeDeleted", "true");
      const res = await fetch(`/api/students?${params.toString()}`);
      const json = (await res.json()) as ApiResponse<{ students: Student[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar alunos.");
        return;
      }
      setItems(json.data.students);
    } finally {
      setLoading(false);
    }
  }, [q, isMaster, includeDeleted, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setOpen(true);
  }

  async function softDelete(s: Student) {
    if (!confirm(`Excluir o aluno "${s.name}"? (exclusão lógica; apenas MASTER pode reativar.)`)) return;
    const res = await fetch(`/api/students/${s.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ student: Student }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Aluno excluído.");
    await load();
  }

  async function reactivate(s: Student) {
    const res = await fetch(`/api/students/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reactivate: true }),
    });
    const json = (await res.json()) as ApiResponse<{ student: Student }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao reativar.");
      return;
    }
    toast.push("success", "Aluno reativado.");
    await load();
  }

  async function permanentDelete(s: Student) {
    if (!confirm(`Excluir definitivamente o aluno "${s.name}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/students/${s.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted?: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Aluno excluído definitivamente.");
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold">Alunos</div>
          <div className="text-sm text-zinc-600">
            Cadastro base do aluno. Busca por nome ou CPF.
          </div>
        </div>
        <Button onClick={openCreate}>Novo aluno</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nome ou CPF"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        {isMaster && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
            />
            Incluir excluídos
          </label>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-zinc-600">Carregando...</div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>CPF</Th>
              <Th>Celular</Th>
              <Th>Escolaridade</Th>
              <Th>Estudando?</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <Td>
                  <span className={s.deletedAt ? "text-zinc-500 line-through" : ""}>{s.name}</span>
                  {s.deletedAt && (
                    <span className="ml-1"><Badge tone="red">Excluído</Badge></span>
                  )}
                </Td>
                <Td>{formatCpf(s.cpf)}</Td>
                <Td>{formatPhone(s.phone)}</Td>
                <Td>{EDUCATION_LEVEL_LABELS[s.educationLevel] ?? s.educationLevel}</Td>
                <Td>{s.isStudying ? STUDY_SHIFT_LABELS[s.studyShift ?? ""] ?? s.studyShift : "Não"}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    {!s.deletedAt && (
                      <Button variant="secondary" onClick={() => openEdit(s)}>
                        Editar
                      </Button>
                    )}
                    {isMaster && (
                      s.deletedAt ? (
                        <>
                          <Button variant="secondary" onClick={() => reactivate(s)}>
                            Reativar
                          </Button>
                          <Button
                            variant="secondary"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => permanentDelete(s)}
                          >
                            Excluir definitivamente
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="secondary"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => softDelete(s)}
                        >
                          Excluir
                        </Button>
                      )
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <Td colSpan={6} className="text-zinc-600">
                  Nenhum aluno encontrado.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      )}

      <Modal
        open={open}
        title={editing ? "Editar aluno" : "Novo aluno"}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <StudentForm
          editing={editing}
          onSuccess={() => {
            setOpen(false);
            setEditing(null);
            void load();
          }}
          onCancel={() => {
            setOpen(false);
            setEditing(null);
          }}
          isMaster={isMaster}
        />
      </Modal>
    </div>
  );
}
