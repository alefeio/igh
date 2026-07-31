"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Modal } from "@/components/ui/Modal";
import { Td, Th } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import type { ApiResponse } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import {
  MANAGED_ACCESS_LABEL,
  managedRolesFromUser,
  type ManagedAccessRole,
  type StaffAccessRole,
} from "@/lib/staff-access";
import { isExactMaster } from "@/lib/rbac";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "GENERAL_ADMIN" | "ADMIN" | "COORDINATOR" | "POLO_COORDINATOR" | "STUDENT" | "TEACHER";
  isAdmin?: boolean;
  isCoordinator?: boolean;
  isPoloCoordinator?: boolean;
  isActive: boolean;
  phone?: string | null;
  birthDate?: string | null;
  coordinatedPoloCount?: number;
  createdAt: string;
};

const STAFF_ACCESS_OPTIONS: { value: ManagedAccessRole; label: string; hint: string; masterOnly?: boolean }[] = [
  {
    value: "GENERAL_ADMIN",
    label: "Administrador Geral",
    hint: "Mesmas permissões do Master, exceto gerir Master e criar/editar Admin Geral",
    masterOnly: true,
  },
  {
    value: "ADMIN",
    label: "Administrador",
    hint: "Pode alterar cadastros",
  },
  {
    value: "COORDINATOR",
    label: "Coordenador",
    hint: "Somente leitura nas áreas de acompanhamento",
  },
  {
    value: "POLO_COORDINATOR",
    label: "Coordenador de Polos",
    hint: "Matrículas dos seus polos",
  },
];

/** Lista todos os acessos do usuário (papel-base + sobreposições). */
function roleLabel(u: AdminUser): string {
  const parts: string[] = [];
  if (u.role === "STUDENT") parts.push("Aluno");
  else if (u.role === "TEACHER") parts.push("Professor");
  else if (u.role === "GENERAL_ADMIN") parts.push("Administrador Geral");
  else if (u.role === "ADMIN") parts.push("Admin");
  else if (u.role === "COORDINATOR") parts.push("Coordenador");
  else if (u.role === "POLO_COORDINATOR") parts.push("Coordenador de Polos");
  if (u.isAdmin && u.role !== "ADMIN") parts.push("Admin");
  if (u.isCoordinator && u.role !== "COORDINATOR") parts.push("Coordenador");
  if (u.isPoloCoordinator && u.role !== "POLO_COORDINATOR") parts.push("Coordenador de Polos");
  return Array.from(new Set(parts)).join(" + ") || u.role;
}

function AccessTypeCheckboxes({
  selected,
  onChange,
  idPrefix,
  allowGeneralAdmin,
  lockPoloCoordinator = false,
  onBlockedPoloUncheck,
}: {
  selected: ManagedAccessRole[];
  onChange: (next: ManagedAccessRole[]) => void;
  idPrefix: string;
  allowGeneralAdmin: boolean;
  /** Impede remover Coordenador de Polos quando há polo vinculado. */
  lockPoloCoordinator?: boolean;
  onBlockedPoloUncheck?: () => void;
}) {
  function toggle(role: ManagedAccessRole) {
    if (role === "GENERAL_ADMIN") {
      if (selected.includes("GENERAL_ADMIN")) {
        // Ao sair do Admin Geral, preserva Coordenador de Polos se houver vínculo.
        onChange(lockPoloCoordinator ? ["POLO_COORDINATOR"] : []);
      } else {
        onChange(["GENERAL_ADMIN"]);
      }
      return;
    }
    const withoutGeneral = selected.filter((r) => r !== "GENERAL_ADMIN") as StaffAccessRole[];
    if (withoutGeneral.includes(role as StaffAccessRole)) {
      if (role === "POLO_COORDINATOR" && lockPoloCoordinator) {
        onBlockedPoloUncheck?.();
        return;
      }
      onChange(withoutGeneral.filter((r) => r !== role));
    } else {
      onChange([...withoutGeneral, role]);
    }
  }

  const options = STAFF_ACCESS_OPTIONS.filter((o) => !o.masterOnly || allowGeneralAdmin);
  const generalSelected = selected.includes("GENERAL_ADMIN");

  return (
    <div className="mt-1 flex flex-col gap-2">
      {options.map((opt) => {
        const inputId = `${idPrefix}-${opt.value}`;
        const poloLocked =
          opt.value === "POLO_COORDINATOR" && lockPoloCoordinator && !generalSelected;
        const checked =
          selected.includes(opt.value) ||
          (opt.value === "POLO_COORDINATOR" && lockPoloCoordinator && generalSelected);
        return (
          <label key={opt.value} htmlFor={inputId} className="flex cursor-pointer items-start gap-2">
            <input
              id={inputId}
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-[var(--input-border)]"
              checked={checked}
              disabled={poloLocked || (opt.value === "POLO_COORDINATOR" && generalSelected && lockPoloCoordinator)}
              onChange={() => toggle(opt.value)}
            />
            <span>
              <span className="block text-sm font-medium">{opt.label}</span>
              <span className="block text-xs text-[var(--text-muted)]">
                {opt.value === "POLO_COORDINATOR" && lockPoloCoordinator
                  ? "Responsável por polo(s) — mantenha o vínculo ou transfira a coordenação antes de remover"
                  : opt.hint}
              </span>
            </span>
          </label>
        );
      })}
      <p className="text-xs text-[var(--text-muted)]">
        É possível marcar mais de um perfil operacional. Administrador Geral é exclusivo e só o Master pode
        atribuir
        {lockPoloCoordinator
          ? "; a responsabilidade pelos polos vinculados é mantida ao promover a Administrador Geral"
          : ""}
        .
      </p>
    </div>
  );
}

export default function UsersPage() {
  const toast = useToast();
  const sessionUser = useUser();
  const isMaster = isExactMaster(sessionUser);
  const canManageUsers =
    sessionUser.role === "MASTER" ||
    sessionUser.role === "GENERAL_ADMIN" ||
    sessionUser.baseRole === "MASTER" ||
    sessionUser.baseRole === "GENERAL_ADMIN";
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [createRoles, setCreateRoles] = useState<ManagedAccessRole[]>(["ADMIN"]);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editRoles, setEditRoles] = useState<ManagedAccessRole[]>(["ADMIN"]);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const canSubmit = useMemo(
    () => name.trim().length >= 2 && email.includes("@") && createRoles.length > 0,
    [name, email, createRoles],
  );
  const canSubmitEdit = useMemo(
    () =>
      editName.trim().length >= 2 &&
      editEmail.includes("@") &&
      (editPassword === "" || editPassword.length >= 8) &&
      (!canManageUsers || editRoles.length > 0),
    [editName, editEmail, editPassword, editRoles, canManageUsers],
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
    setEditPhone(u.phone ?? "");
    setEditBirthDate(u.birthDate ?? "");
    setEditPassword("");
    setEditIsActive(u.isActive);
    setEditRoles(managedRolesFromUser(u));
    setEditOpen(true);
  }

  async function updateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitEdit || !editing || savingEdit) return;
    if (editing.role === "GENERAL_ADMIN" && !isMaster) {
      toast.push("error", "Somente o Master pode editar Administrador Geral.");
      return;
    }
    const linkedToPolo = (editing.coordinatedPoloCount ?? 0) > 0;
    if (
      canManageUsers &&
      linkedToPolo &&
      !editRoles.includes("GENERAL_ADMIN") &&
      !editRoles.includes("POLO_COORDINATOR")
    ) {
      toast.push(
        "error",
        "Não é possível remover Coordenador de Polos enquanto o usuário for responsável por polo(s). Transfira a coordenação antes.",
      );
      return;
    }
    setSavingEdit(true);
    try {
      const payload: {
        name: string;
        email: string;
        isActive: boolean;
        phone?: string;
        birthDate?: string;
        password?: string;
        roles?: ManagedAccessRole[];
      } = {
        name: editName,
        email: editEmail,
        isActive: editIsActive,
        phone: editPhone.replace(/\D/g, ""),
        birthDate: editBirthDate.trim(),
      };
      if (editPassword.trim() !== "") payload.password = editPassword;
      if (canManageUsers) {
        payload.roles = editRoles;
      }

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
        body: JSON.stringify({
          name,
          email,
          roles: createRoles,
          phone: phone.replace(/\D/g, ""),
          birthDate: birthDate.trim(),
        }),
      });
      const json = (await res.json()) as ApiResponse<{
        user: { id: string };
        emailSent?: boolean;
        temporaryPassword?: string;
        alreadyRegisteredAs?: string;
        grantedLabels?: string[];
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao criar admin.");
        return;
      }
      if (json.data.alreadyRegisteredAs) {
        const grantedLabel =
          (json.data.grantedLabels && json.data.grantedLabels.length > 0
            ? json.data.grantedLabels.join(", ")
            : createRoles.map((r) => MANAGED_ACCESS_LABEL[r]).join(", ")) || "acesso administrativo";
        toast.push(
          "success",
          `Usuário já cadastrado como ${json.data.alreadyRegisteredAs}. Foi concedido acesso como ${grantedLabel}. Ao entrar no sistema, ele poderá escolher o perfil desejado.`,
        );
      } else if (json.data.emailSent) {
        toast.push("success", "Usuário criado. E-mail de acesso enviado para o novo usuário.");
      } else {
        const senha = json.data.temporaryPassword ? ` Senha temporária: ${json.data.temporaryPassword}.` : "";
        toast.push(
          "error",
          `Usuário criado, mas o e-mail não foi enviado. Passe o link de login e essa senha ao novo usuário.${senha}`,
        );
      }
      setOpen(false);
      setName("");
      setEmail("");
      setPhone("");
      setBirthDate("");
      setCreateRoles(["ADMIN"]);
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
        title="Usuários administrativos"
        description='Administradores e coordenadores (somente leitura). Por padrão, apenas ativos — use "Exibir inativos" para reativar ou excluir.'
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
              Novo usuário
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
                <Th>Perfil</Th>
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
                    <span className="text-sm text-[var(--text-secondary)]">{roleLabel(u)}</span>
                  </Td>
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
                      <Button
                        variant="secondary"
                        onClick={() => openEdit(u)}
                        disabled={u.role === "GENERAL_ADMIN" && !isMaster}
                        title={
                          u.role === "GENERAL_ADMIN" && !isMaster
                            ? "Somente o Master pode editar Administrador Geral"
                            : undefined
                        }
                      >
                        Editar
                      </Button>
                      {u.isActive ? (
                        <Button
                          variant="secondary"
                          onClick={() => deactivateUser(u)}
                          disabled={u.role === "GENERAL_ADMIN" && !isMaster}
                          className="text-red-600 hover:text-red-700"
                        >
                          Inativar
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => reactivateUser(u)}
                            disabled={u.role === "GENERAL_ADMIN" && !isMaster}
                          >
                            Reativar
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => deleteUserPermanent(u)}
                            disabled={u.role === "GENERAL_ADMIN" && !isMaster}
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
                  <Td colSpan={6}>
                    <span className="text-[var(--text-secondary)]">
                      {showInactive
                        ? "Nenhum usuário encontrado."
                        : "Nenhum usuário administrativo ativo cadastrado."}
                    </span>
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </TableShell>
        )}
      </SectionCard>

      <Modal
        open={editOpen}
        title="Editar usuário"
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
          setEditName("");
          setEditEmail("");
          setEditPassword("");
          setEditIsActive(true);
          setEditRoles(["ADMIN"]);
        }}
      >
        <form className="flex flex-col gap-3" onSubmit={updateAdmin}>
          <div>
            <label className="text-sm font-medium">Nome</label>
            <div className="mt-1">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          </div>
          {canManageUsers ? (
            <div>
              <label className="text-sm font-medium">Tipo de acesso</label>
              <AccessTypeCheckboxes
                idPrefix="edit-access"
                selected={editRoles}
                onChange={setEditRoles}
                allowGeneralAdmin={isMaster}
                lockPoloCoordinator={(editing?.coordinatedPoloCount ?? 0) > 0}
                onBlockedPoloUncheck={() =>
                  toast.push(
                    "error",
                    "Não é possível remover Coordenador de Polos enquanto o usuário for responsável por polo(s). Transfira a coordenação antes.",
                  )
                }
              />
              {editRoles.length === 0 ? (
                <p className="mt-1 text-xs text-red-600">Selecione ao menos um tipo de acesso.</p>
              ) : null}
              {editing?.role === "GENERAL_ADMIN" && !isMaster ? (
                <p className="mt-1 text-xs text-red-600">Somente o Master pode alterar Administrador Geral.</p>
              ) : null}
            </div>
          ) : null}
          <div>
            <label className="text-sm font-medium">E-mail</label>
            <div className="mt-1">
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Telefone / WhatsApp</label>
            <div className="mt-1">
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                inputMode="tel"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Data de nascimento</label>
            <div className="mt-1">
              <Input type="date" value={editBirthDate} onChange={(e) => setEditBirthDate(e.target.value)} />
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
            <label htmlFor="editIsActive" className="text-sm">
              Ativo
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditOpen(false);
                setEditing(null);
                setEditRoles(["ADMIN"]);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmitEdit || savingEdit}>
              {savingEdit ? "Salvando" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={open}
        title="Novo usuário administrativo"
        onClose={() => {
          setOpen(false);
          setName("");
          setEmail("");
          setPhone("");
          setBirthDate("");
          setCreateRoles(["ADMIN"]);
        }}
      >
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
            <label className="text-sm font-medium">Telefone / WhatsApp</label>
            <div className="mt-1">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                inputMode="tel"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Data de nascimento</label>
            <div className="mt-1">
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Tipo de acesso</label>
            <AccessTypeCheckboxes
              idPrefix="create-access"
              selected={createRoles}
              onChange={setCreateRoles}
              allowGeneralAdmin={isMaster}
            />
            {createRoles.length === 0 ? (
              <p className="mt-1 text-xs text-red-600">Selecione ao menos um tipo de acesso.</p>
            ) : null}
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
