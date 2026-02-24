"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import type { ApiResponse } from "@/lib/api-types";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN";
  isActive: boolean;
  createdAt: string;
};

export default function UsersPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const canSubmit = useMemo(
    () => name.trim().length >= 2 && email.includes("@") && password.length >= 8,
    [name, email, password],
  );

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const json = (await res.json()) as ApiResponse<{ users: AdminUser[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar usuários.");
        return;
      }
      setUsers(json.data.users);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const json = (await res.json()) as ApiResponse<{ user: { id: string } }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao criar admin.");
      return;
    }
    toast.push("success", "Admin criado.");
    setOpen(false);
    setName("");
    setEmail("");
    setPassword("");
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Usuários (ADMIN)</div>
          <div className="text-sm text-zinc-600">Apenas MASTER pode listar e criar ADMINs.</div>
        </div>
        <Button onClick={() => setOpen(true)}>Novo ADMIN</Button>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-600">Carregando...</div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>E-mail</Th>
              <Th>Status</Th>
              <Th>Criado em</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <Td>{u.name}</Td>
                <Td>{u.email}</Td>
                <Td>
                  {u.isActive ? (
                    <Badge tone="green">Ativo</Badge>
                  ) : (
                    <Badge tone="red">Inativo</Badge>
                  )}
                </Td>
                <Td>{new Date(u.createdAt).toLocaleString()}</Td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <Td>
                  <span className="text-zinc-600">Nenhum ADMIN cadastrado.</span>
                </Td>
                <Td />
                <Td />
                <Td />
              </tr>
            ) : null}
          </tbody>
        </Table>
      )}

      <Modal open={open} title="Criar usuário ADMIN" onClose={() => setOpen(false)}>
        <form className="flex flex-col gap-3" onSubmit={createAdmin}>
          <div>
            <label className="text-sm font-medium">Nome</label>
            <div className="mt-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">E-mail</label>
            <div className="mt-1">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Senha</label>
            <div className="mt-1">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Criar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
