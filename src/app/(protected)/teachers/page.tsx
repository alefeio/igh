"use client";

import { useEffect, useMemo, useState } from "react";

import { CloudinaryImageUpload } from "@/components/admin/CloudinaryImageUpload";
import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Td, Th } from "@/components/ui/Table";
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
  photoUrl: string | null;
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

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2 && email.trim().length > 0;
  }, [name, email]);

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setPhotoUrl("");
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
    setPhotoUrl(t.photoUrl ?? "");
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
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        isActive,
      };
      if (editing) {
        payload.photoUrl = photoUrl.trim();
      } else if (photoUrl.trim()) {
        payload.photoUrl = photoUrl.trim();
      }
      const url = editing ? `/api/teachers/${editing.id}` : "/api/teachers";
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await parseResponseJson<{ teacher: Teacher; linkedToExistingUser?: boolean }>(res);
      if (!res.ok || !json?.ok) {
        toast.push("error", apiErrorMessage(json, "Falha ao salvar professor."));
        return;
      }
      if (!editing && json.data?.linkedToExistingUser) {
        toast.push("success", "Professor criado e vinculado ao usuário existente.");
      } else {
        toast.push("success", editing ? "Professor atualizado." : "Professor criado.");
      }
      setOpen(false);
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
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
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <DashboardHero
        eyebrow="Cadastros"
        title="Professores"
        description="Filtro: ativos (padrão), inativos ou todos. Inativos podem ser reativados ou excluídos."
        rightSlot={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className="flex rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-0.5 text-sm shadow-sm">
              {(["active", "inactive", "all"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-3 py-1.5 touch-manipulation ${
                    statusFilter === s ? "bg-[var(--igh-primary)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
                  }`}
                >
                  {s === "active" ? "Ativos" : s === "inactive" ? "Inativos" : "Todos"}
                </button>
              ))}
            </div>
            <Button onClick={openCreate} className="w-full sm:w-auto">
              Novo professor
            </Button>
          </div>
        }
      />

      <SectionCard
        title="Corpo docente"
        description={loading ? "Carregando…" : `${items.length} ${items.length === 1 ? "cadastro" : "cadastros"}.`}
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
              <Th>Foto</Th>
              <Th>Nome</Th>
              <Th>Contato</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <Td>
                  {t.photoUrl?.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.photoUrl.trim()}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover ring-1 ring-[var(--card-border)]"
                    />
                  ) : (
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--igh-surface)] text-xs text-[var(--text-muted)] ring-1 ring-[var(--card-border)]">
                      —
                    </span>
                  )}
                </Td>
                <Td>{t.name}</Td>
                <Td>
                  <div className="flex flex-col">
                    <span className="text-[var(--text-primary)]">{t.email ?? "-"}</span>
                    <span className="text-xs text-[var(--text-muted)]">{t.phone ?? ""}</span>
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
                  <span className="text-[var(--text-secondary)]">Nenhum professor cadastrado.</span>
                </Td>
                <Td />
                <Td />
                <Td />
                <Td />
              </tr>
            ) : null}
          </tbody>
        </TableShell>
        )}
      </SectionCard>

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
            {!editing && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Um mesmo usuário pode ter vários perfis. Se o e-mail já existir como <strong>aluno</strong> ou <strong>admin</strong>, o perfil de professor será vinculado (a pessoa poderá acessar como Professor) e nenhuma senha será enviada. E-mail novo: senha temporária será enviada por e-mail.
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Telefone (opcional)</label>
            <div className="mt-1">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Foto (opcional)</label>
            <Input
              className="mt-1"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
            />
            <CloudinaryImageUpload
              kind="teachers"
              currentUrl={photoUrl.trim() || undefined}
              onUploaded={(url) => setPhotoUrl(url)}
              label="Enviar foto"
            />
            {photoUrl.trim() ? (
              <div className="mt-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl.trim()} alt="" className="h-20 w-20 rounded-full object-cover ring-1 ring-[var(--card-border)]" />
                <Button type="button" variant="secondary" size="sm" onClick={() => setPhotoUrl("")}>
                  Remover foto
                </Button>
              </div>
            ) : null}
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
            <Button type="submit" disabled={!canSubmit || saving}>
              {saving ? "Salvando" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
