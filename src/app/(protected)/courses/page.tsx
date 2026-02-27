"use client";

import { useEffect, useMemo, useState } from "react";

import { CloudinaryImageUpload } from "@/components/admin/CloudinaryImageUpload";
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
  content: string | null;
  imageUrl: string | null;
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
  const [showInactive, setShowInactive] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [workloadHours, setWorkloadHours] = useState<string>("");
  const [status, setStatus] = useState<Course["status"]>("ACTIVE");

  const canSubmit = useMemo(() => name.trim().length >= 2, [name]);

  function resetForm() {
    setName("");
    setDescription("");
    setContent("");
    setImageUrl("");
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
    setContent(c.content ?? "");
    setImageUrl(c.imageUrl ?? "");
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

  async function inactivateCourse(c: Course) {
    if (!confirm(`Inativar o curso "${c.name}"?`)) return;
    const res = await fetch(`/api/courses/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "INACTIVE" }),
    });
    const json = (await res.json()) as ApiResponse<{ course: Course }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error?.message ?? "Erro" : "Falha ao inativar.");
      return;
    }
    toast.push("success", "Curso inativado.");
    await load();
  }

  async function reactivateCourse(c: Course) {
    const res = await fetch(`/api/courses/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    const json = (await res.json()) as ApiResponse<{ course: Course }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error?.message ?? "Erro" : "Falha ao reativar.");
      return;
    }
    toast.push("success", "Curso reativado.");
    await load();
  }

  async function deleteCourse(c: Course) {
    const msg = "Tem certeza que deseja excluir definitivamente este curso?";
    if (!confirm(msg)) return;
    const res = await fetch(`/api/courses/${c.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted?: boolean; inactivated?: boolean; message?: string }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error?.message ?? "Erro" : "Falha ao excluir.");
      return;
    }
    if (json.data?.inactivated) {
      toast.push("success", json.data.message ?? "Curso possui turmas; foi inativado.");
    } else {
      toast.push("success", "Curso excluído.");
    }
    await load();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const payload: {
      name: string;
      description: string;
      content: string;
      imageUrl: string;
      status: Course["status"];
      workloadHours?: number;
    } = {
      name,
      description,
      content,
      imageUrl,
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

  const visibleItems = showInactive ? items : items.filter((c) => c.status === "ACTIVE");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-lg font-semibold">Cursos</div>
          <div className="text-sm text-zinc-600">
            Listagem em ordem alfabética. Por padrão, mostra apenas cursos ativos.
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowInactive((prev) => !prev)}
          >
            {showInactive ? "Ocultar inativos" : "Exibir inativos"}
          </Button>
          <Button onClick={openCreate} className="w-full sm:w-auto">Novo</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-600">Carregando...</div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Foto</Th>
              <Th>Nome</Th>
              <Th>Status</Th>
              <Th>Carga horária</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((c) => (
              <tr key={c.id}>
                <Td>
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </Td>
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
                    {c.status === "ACTIVE" ? (
                      <Button
                        variant="secondary"
                        onClick={() => inactivateCourse(c)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Inativar
                      </Button>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={() => reactivateCourse(c)}>
                          Reativar
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => deleteCourse(c)}
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
                <Td />
                <Td>
                  <span className="text-zinc-600">
                    {showInactive
                      ? "Nenhum curso encontrado."
                      : "Nenhum curso ativo cadastrado."}
                  </span>
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
        onClose={() => { setOpen(false); resetForm(); }}
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
            <label className="text-sm font-medium">Conteúdo (rich text, opcional)</label>
            <div className="mt-1">
              <textarea
                className="min-h-[120px] w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="HTML ou texto longo..."
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">URL da foto (opcional)</label>
            <div className="mt-1">
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              <CloudinaryImageUpload
                kind="formations"
                currentUrl={imageUrl || undefined}
                onUploaded={setImageUrl}
                label="Ou envie uma imagem"
              />
            </div>
            {imageUrl && (
              <img src={imageUrl} alt="Preview" className="mt-2 h-20 rounded object-cover" />
            )}
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
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); resetForm(); }}>
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
