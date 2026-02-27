"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import type { ApiResponse } from "@/lib/api-types";

async function parseResponseJson<T>(res: Response): Promise<ApiResponse<T> | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return null;
  }
}

function apiErrorMessage(json: ApiResponse<unknown> | null, fallback: string): string {
  if (json && !json.ok) return json.error.message;
  return fallback;
}

type Teacher = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
};

type StatusFilter = "active" | "inactive" | "all";

export default function TeachersPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Teacher[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2 && email.trim().length > 0;
  }, [name, email]);

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setIsActive(true);
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(t: Teacher) {
    setEditing(t);
    setName(t.name);
    setEmail(t.email ?? "");
    setPhone(t.phone ?? "");
    setIsActive(t.isActive);
    setOpen(true);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/teachers?status=${statusFilter}`);
      const json = await parseResponseJson<{ teachers: Teacher[] }>(res);
      if (!res.ok || !json?.ok) {
        toast.push("error", apiErrorMessage(json, "Falha ao carregar professores."));
        return;
      }
      setItems(json.data.teachers);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      isActive,
    };
    const url = editing ? `/api/teachers/${editing.id}` : "/api/teachers";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await parseResponseJson<{ teacher: Teacher }>(res);
    if (!res.ok || !json?.ok) {
      toast.push("error", apiErrorMessage(json, "Falha ao salvar professor."));
      return;
    }
    toast.push("success", editing ? "Professor atualizado." : "Professor criado.");
    setOpen(false);
    resetForm();
    await load();
  }

  async function inactivateTeacher(t: Teacher) {
    if (!confirm(`Inativar o professor "${t.name}"?`)) return;
    const res = await fetch(`/api/teachers/${t.id}`, { method: "DELETE" });
    const json = await parseResponseJson<{ teacher?: Teacher; deleted?: boolean }>(res);
    if (!res.ok || !json?.ok) {
      toast.push("error", apiErrorMessage(json, "Falha ao inativar professor."));
      return;
    }
    toast.push("success", "Professor inativado.");
    await load();
  }

  async function deleteTeacherPermanent(t: Teacher) {
    if (!confirm(`Excluir definitivamente o professor "${t.name}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/teachers/${t.id}`, { method: "DELETE" });
    const json = await parseResponseJson<{ deleted?: boolean }>(res);
    if (!res.ok || !json?.ok) {
      toast.push("error", apiErrorMessage(json, "Falha ao excluir professor."));
      return;
    }
    toast.push("success", "Professor excluído.");
    await load();
  }

  async function reactivate(t: Teacher) {
    const res = await fetch(`/api/teachers/${t.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const json = await parseResponseJson<{ teacher: Teacher }>(res);
    if (!res.ok || !json?.ok) {
      toast.push("error", apiErrorMessage(json, "Falha ao reativar professor."));
      return;
    }
    toast.push("success", "Professor reativado.");
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-lg font-semibold">Professores</div>
          <div className="text-sm text-zinc-600">
            Filtro: Ativos (padrão), Inativos ou Todos. Inativos podem ser reativados.
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="flex rounded-md border border-zinc-300 bg-white p-0.5 text-sm">
            {(["active", "inactive", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded px-3 py-1.5 touch-manipulation ${
                  statusFilter === s ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {s === "active" ? "Ativos" : s === "inactive" ? "Inativos" : "Todos"}
              </button>
            ))}
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto">Novo</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-600">Carregando...</div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Contato</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <Td>{t.name}</Td>
                <Td>
                  <div className="flex flex-col">
                    <span className="text-zinc-800">{t.email ?? "-"}</span>
                    <span className="text-xs text-zinc-500">{t.phone ?? ""}</span>
                  </div>
                </Td>
                <Td>
                  {t.isActive ? (
                    <Badge tone="green">Ativo</Badge>
                  ) : (
                    <Badge tone="red">Inativo</Badge>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openEdit(t)}>
                      Editar
                    </Button>
                    {t.isActive && !t.deletedAt ? (
                      <Button variant="secondary" onClick={() => inactivateTeacher(t)} className="text-red-600 hover:text-red-700">
                        Inativar
                      </Button>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={() => reactivate(t)}>
                          Reativar
                        </Button>
                        <Button variant="secondary" onClick={() => deleteTeacherPermanent(t)} className="text-red-600 hover:text-red-700">
                          Excluir
                        </Button>
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <Td>
                  <span className="text-zinc-600">Nenhum professor cadastrado.</span>
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
        title={editing ? "Editar professor" : "Novo professor"}
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
            <label className="text-sm font-medium">E-mail</label>
            <div className="mt-1">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Uma senha temporária será gerada e enviada por e-mail ao professor.
          </p>
          <div>
            <label className="text-sm font-medium">Telefone (opcional)</label>
            <div className="mt-1">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="isActiveTeacher"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="isActiveTeacher" className="text-sm">
              Ativo
            </label>
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
