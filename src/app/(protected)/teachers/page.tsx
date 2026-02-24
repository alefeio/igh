"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import type { ApiResponse } from "@/lib/api-types";

type Teacher = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function TeachersPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Teacher[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);

  const canSubmit = useMemo(() => name.trim().length >= 2, [name]);

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
      const res = await fetch("/api/teachers");
      const json = (await res.json()) as ApiResponse<{ teachers: Teacher[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar professores.");
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
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const payload = { name, email, phone, isActive };
    const url = editing ? `/api/teachers/${editing.id}` : "/api/teachers";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as ApiResponse<{ teacher: Teacher }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao salvar professor.");
      return;
    }
    toast.push("success", editing ? "Professor atualizado." : "Professor criado.");
    setOpen(false);
    resetForm();
    await load();
  }

  async function softDelete(t: Teacher) {
    if (!confirm(`Inativar/Excluir (soft delete) o professor "${t.name}"?`)) return;
    const res = await fetch(`/api/teachers/${t.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ teacher: Teacher }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao inativar professor.");
      return;
    }
    toast.push("success", "Professor inativado.");
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Professores</div>
          <div className="text-sm text-zinc-600">CRUD com soft delete (inativar).</div>
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
                    <Button variant="danger" onClick={() => softDelete(t)}>
                      Inativar
                    </Button>
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
            <label className="text-sm font-medium">E-mail (opcional)</label>
            <div className="mt-1">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
          </div>
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
