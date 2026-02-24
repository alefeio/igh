"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Course = {
  id: string;
  name: string;
  description: string | null;
  workloadHours: number | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
};

export default function CoursesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workloadHours, setWorkloadHours] = useState<string>("");
  const [status, setStatus] = useState<Course["status"]>("ACTIVE");

  const canSubmit = useMemo(() => name.trim().length >= 2, [name]);

  function resetForm() {
    setName("");
    setDescription("");
    setWorkloadHours("");
    setStatus("ACTIVE");
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(c: Course) {
    setEditing(c);
    setName(c.name);
    setDescription(c.description ?? "");
    setWorkloadHours(c.workloadHours?.toString() ?? "");
    setStatus(c.status);
    setOpen(true);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/courses");
      const json = (await res.json()) as ApiResponse<{ courses: Course[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar cursos.");
        return;
      }
      setItems(json.data.courses);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const payload: {
      name: string;
      description: string;
      status: Course["status"];
      workloadHours?: number;
    } = {
      name,
      description,
      status,
    };
    if (workloadHours.trim() !== "") {
      payload.workloadHours = Number(workloadHours);
    }

    const url = editing ? `/api/courses/${editing.id}` : "/api/courses";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as ApiResponse<{ course: Course }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao salvar curso.");
      return;
    }
    toast.push("success", editing ? "Curso atualizado." : "Curso criado.");
    setOpen(false);
    resetForm();
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Cursos</div>
          <div className="text-sm text-zinc-600">CRUD com status ativo/inativo.</div>
        </div>
        <Button onClick={openCreate}>Novo</Button>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-600">Carregando...</div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Status</Th>
              <Th>Carga horária</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <Td>
                  <div className="flex flex-col">
                    <span className="font-medium text-zinc-900">{c.name}</span>
                    <span className="text-xs text-zinc-500">{c.description ?? ""}</span>
                  </div>
                </Td>
                <Td>
                  {c.status === "ACTIVE" ? (
                    <Badge tone="green">Ativo</Badge>
                  ) : (
                    <Badge tone="red">Inativo</Badge>
                  )}
                </Td>
                <Td>{c.workloadHours ?? "-"}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openEdit(c)}>
                      Editar
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <Td>
                  <span className="text-zinc-600">Nenhum curso cadastrado.</span>
                </Td>
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
        title={editing ? "Editar curso" : "Novo curso"}
        onClose={() => setOpen(false)}
      >
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Nome</label>
            <div className="mt-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Descrição (opcional)</label>
            <div className="mt-1">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Carga horária (opcional)</label>
            <div className="mt-1">
              <Input
                value={workloadHours}
                onChange={(e) => setWorkloadHours(e.target.value)}
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
                onChange={(e) => setStatus(e.target.value as Course["status"])}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
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
