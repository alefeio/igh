"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Modal } from "@/components/ui/Modal";
import { Td, Th } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import type { ApiResponse } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STUDENT" | "TEACHER";
  isAdmin?: boolean;
  isActive: boolean;
  createdAt: string;
};

export default function UsersPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const canSubmit = useMemo(
    () => name.trim().length >= 2 && email.includes("@"),
    [name, email],
  );
  const canSubmitEdit = useMemo(
    () => editName.trim().length >= 2 && editEmail.includes("@") && (editPassword === "" || editPassword.length >= 8),
    [editName, editEmail, editPassword],
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

  function openEdit(u: AdminUser) {
    setEditing(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword("");
    setEditIsActive(u.isActive);
    setEditOpen(true);
  }

  async function updateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitEdit || !editing || savingEdit) return;
    setSavingEdit(true);
    try {
      const payload: { name: string; email: string; isActive: boolean; password?: string } = {
        name: editName,
        email: editEmail,
        isActive: editIsActive,
      };
      if (editPassword.trim() !== "") payload.password = editPassword;

      const res = await fetch(`/api/admin/users/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResponse<{ user: AdminUser }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao atualizar usuário.");
        return;
      }
      toast.push("success", "Usuário atualizado.");
      setEditOpen(false);
      setEditing(null);
      await load();
    } finally {
      setSavingEdit(false);
    }
  }

  async function deactivateUser(u: AdminUser) {
    if (!confirm(`Desativar o usuário "${u.name}"? Ele não poderá mais fazer login.`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ user: AdminUser }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao desativar usuário.");
      return;
    }
    toast.push("success", "Usuário desativado.");
    await load();
  }

  async function reactivateUser(u: AdminUser) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const json = (await res.json()) as ApiResponse<{ user: AdminUser }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao reativar usuário.");
      return;
    }
    toast.push("success", "Usuário reativado.");
    await load();
  }

  async function deleteUserPermanent(u: AdminUser) {
    if (!confirm(`Excluir definitivamente o usuário "${u.name}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/admin/users/${u.id}?permanent=true`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted?: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir usuário.");
      return;
    }
    toast.push("success", "Usuário excluído.");
    await load();
  }

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || savingCreate) return;
    setSavingCreate(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const json = (await res.json()) as ApiResponse<{
        user: { id: string };
        emailSent?: boolean;
        temporaryPassword?: string;
        alreadyRegisteredAs?: string;
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao criar admin.");
        return;
      }
      if (json.data.alreadyRegisteredAs) {
        toast.push(
          "success",
        `Usuário já cadastrado como ${json.data.alreadyRegisteredAs}. Foi concedido acesso como Admin. Ao entrar no sistema, ele poderá escolher usar como ${json.data.alreadyRegisteredAs} ou Admin.`
      );
    } else if (json.data.emailSent) {
      toast.push("success", "Admin criado. E-mail de acesso enviado para o novo usuário.");
    } else {
      const senha = json.data.temporaryPassword ? ` Senha temporária: ${json.data.temporaryPassword}.` : "";
      toast.push("error", `Admin criado, mas o e-mail não foi enviado. Passe o link de login e essa senha ao novo usuário.${senha}`);
    }
      setOpen(false);
      setName("");
      setEmail("");
      await load();
    } finally {
      setSavingCreate(false);
    }
  }

  const visibleUsers = showInactive ? users : users.filter((u) => u.isActive);

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <DashboardHero
        eyebrow="Administração"
        title="Usuários ADMIN"
        description='Contas com perfil administrativo. Por padrão, apenas ativos — use "Exibir inativos" para reativar ou excluir.'
        rightSlot={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowInactive((prev) => !prev)}
              className="w-full sm:w-auto"
            >
              {showInactive ? "Ocultar inativos" : "Exibir inativos"}
            </Button>
            <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
              Novo ADMIN
            </Button>
          </div>
        }
      />

      <SectionCard
        title="Listagem"
        description={
          loading
            ? "Carregando usuários…"
            : `${visibleUsers.length} ${visibleUsers.length === 1 ? "registro" : "registros"} exibidos.`
        }
        variant="elevated"
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
              <Th>Nome</Th>
              <Th>E-mail</Th>
              <Th>Status</Th>
              <Th>Criado em</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((u) => (
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
                <Td>{formatDateTime(u.createdAt)}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openEdit(u)}>
                      Editar
                    </Button>
                    {u.isActive ? (
                      <Button
                        variant="secondary"
                        onClick={() => deactivateUser(u)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Inativar
                      </Button>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={() => reactivateUser(u)}>
                          Reativar
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => deleteUserPermanent(u)}
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
            {visibleUsers.length === 0 ? (
              <tr>
                <Td colSpan={5}>
                  <span className="text-[var(--text-secondary)]">
                    {showInactive ? "Nenhum usuário encontrado." : "Nenhum ADMIN ativo cadastrado."}
                  </span>
                </Td>
              </tr>
            ) : null}
          </tbody>
        </TableShell>
        )}
      </SectionCard>

      <Modal open={editOpen} title="Editar usuário" onClose={() => { setEditOpen(false); setEditing(null); setEditName(""); setEditEmail(""); setEditPassword(""); setEditIsActive(true); }}>
        <form className="flex flex-col gap-3" onSubmit={updateAdmin}>
          <div>
            <label className="text-sm font-medium">Nome</label>
            <div className="mt-1">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">E-mail</label>
            <div className="mt-1">
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Nova senha (opcional)</label>
            <div className="mt-1">
              <PasswordInput
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Deixe em branco para manter"
              />
            </div>
            {editPassword.length > 0 && editPassword.length < 8 && (
              <p className="mt-1 text-xs text-red-600">Mínimo 8 caracteres.</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              id="editIsActive"
              type="checkbox"
              checked={editIsActive}
              onChange={(e) => setEditIsActive(e.target.checked)}
            />
            <label htmlFor="editIsActive" className="text-sm">Ativo</label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setEditOpen(false); setEditing(null); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmitEdit || savingEdit}>
              {savingEdit ? "Salvando" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={open} title="Criar usuário ADMIN" onClose={() => { setOpen(false); setName(""); setEmail(""); }}>
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
          <p className="text-xs text-[var(--text-muted)]">
            Uma senha temporária será gerada e enviada por e-mail ao usuário. Ele deverá trocá-la no primeiro acesso.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || savingCreate}>
              {savingCreate ? "Criando" : "Criar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
