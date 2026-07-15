"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";

import { useToast } from "@/components/feedback/ToastProvider";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type CoordUser = { id: string; name: string; email: string };

type PoloLocationRow = {
  id?: string;
  name: string;
  address: string;
  isActive: boolean;
  classGroupsCount?: number;
};

type Polo = {
  id: string;
  name: string;
  isActive: boolean;
  coordinatorUserId: string;
  coordinator: { id: string; name: string; email: string };
  locations: Array<{
    id: string;
    name: string;
    address: string | null;
    isActive: boolean;
    classGroupsCount: number;
  }>;
  locationsCount: number;
};

export default function AdminPolosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [polos, setPolos] = useState<Polo[]>([]);
  const [coordinators, setCoordinators] = useState<CoordUser[]>([]);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Polo | null>(null);

  const [name, setName] = useState("");
  const [coordinatorUserId, setCoordinatorUserId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [locations, setLocations] = useState<PoloLocationRow[]>([
    { name: "", address: "", isActive: true },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [polosRes, coordsRes] = await Promise.all([
        fetch("/api/admin/polos", { cache: "no-store" }),
        fetch("/api/admin/polos/coordinators", { cache: "no-store" }),
      ]);
      const polosJson = (await polosRes.json()) as ApiResponse<{ polos: Polo[] }>;
      const coordsJson = (await coordsRes.json()) as ApiResponse<{ users: CoordUser[] }>;
      if (!polosRes.ok || !polosJson.ok) {
        toast.push("error", !polosJson.ok ? polosJson.error?.message : "Falha ao carregar polos.");
        return;
      }
      setPolos(polosJson.data.polos);
      if (coordsRes.ok && coordsJson.ok) setCoordinators(coordsJson.data.users);
    } catch {
      toast.push("error", "Falha ao carregar polos.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setCoordinatorUserId(coordinators[0]?.id ?? "");
    setIsActive(true);
    setLocations([{ name: "", address: "", isActive: true }]);
    setOpen(true);
  }

  function openEdit(p: Polo) {
    setEditing(p);
    setName(p.name);
    setCoordinatorUserId(p.coordinatorUserId);
    setIsActive(p.isActive);
    setLocations(
      p.locations.length > 0
        ? p.locations.map((l) => ({
            id: l.id,
            name: l.name,
            address: l.address ?? "",
            isActive: l.isActive,
            classGroupsCount: l.classGroupsCount,
          }))
        : [{ name: "", address: "", isActive: true }],
    );
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      toast.push("error", "Informe o nome do polo.");
      return;
    }
    if (!coordinatorUserId) {
      toast.push("error", "Selecione o coordenador do polo.");
      return;
    }
    const cleanedLocations = locations
      .map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        name: l.name.trim(),
        address: l.address.trim() || null,
        isActive: l.isActive,
      }))
      .filter((l) => l.name.length > 0);

    setSaving(true);
    try {
      const url = editing ? `/api/admin/polos/${editing.id}` : "/api/admin/polos";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          coordinatorUserId,
          isActive,
          locations: cleanedLocations,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ polo: Polo }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message : "Não foi possível salvar.");
        return;
      }
      toast.push("success", editing ? "Polo atualizado." : "Polo criado.");
      setOpen(false);
      await load();
    } catch {
      toast.push("error", "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Polo) {
    if (!confirm(`Excluir o polo "${p.name}"? Locais sem turmas vinculadas também serão removidos.`)) return;
    const res = await fetch(`/api/admin/polos/${p.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error?.message : "Não foi possível excluir.");
      return;
    }
    toast.push("success", "Polo excluído.");
    await load();
  }

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        title="Polos"
        description="Cadastre os polos do IGH, o coordenador responsável e os locais de cada polo. As turmas podem ser vinculadas a um local."
      />

      <SectionCard
        title="Polos cadastrados"
        description={
          coordinators.length === 0
            ? "Crie primeiro um usuário com perfil Coordenador de Polos em Administração → Usuários."
            : "Gerencie polos, locais e coordenadores."
        }
        action={
          <Button type="button" onClick={openCreate} disabled={coordinators.length === 0}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Novo polo
          </Button>
        }
      >
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : polos.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum polo cadastrado ainda.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Polo</Th>
                <Th>Coordenador</Th>
                <Th>Locais</Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {polos.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium">{p.name}</Td>
                  <Td>
                    <div className="flex flex-col">
                      <span>{p.coordinator.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">{p.coordinator.email}</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-0.5">
                      {p.locations.filter((l) => l.isActive).length === 0 ? (
                        <span className="text-[var(--text-muted)]">—</span>
                      ) : (
                        p.locations
                          .filter((l) => l.isActive)
                          .map((l) => (
                            <span key={l.id} className="inline-flex items-center gap-1 text-sm">
                              <MapPin className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden />
                              {l.name}
                              {l.classGroupsCount > 0 ? (
                                <span className="text-xs text-[var(--text-muted)]">
                                  ({l.classGroupsCount} turma{l.classGroupsCount === 1 ? "" : "s"})
                                </span>
                              ) : null}
                            </span>
                          ))
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={p.isActive ? "green" : "zinc"}>
                      {p.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="inline-flex gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => void remove(p)}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar polo" : "Novo polo"}
        size="large"
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Nome do polo</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Polo São Luís" />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Coordenador de Polos</span>
            <select
              className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              value={coordinatorUserId}
              onChange={(e) => setCoordinatorUserId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Polo ativo
          </label>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Locais</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setLocations((prev) => [...prev, { name: "", address: "", isActive: true }])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                Local
              </Button>
            </div>
            {locations.map((loc, idx) => (
              <div
                key={loc.id ?? `new-${idx}`}
                className="grid gap-2 rounded-lg border border-[var(--card-border)] p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
              >
                <Input
                  value={loc.name}
                  onChange={(e) =>
                    setLocations((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, name: e.target.value } : row)),
                    )
                  }
                  placeholder="Nome do local"
                />
                <Input
                  value={loc.address}
                  onChange={(e) =>
                    setLocations((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, address: e.target.value } : row)),
                    )
                  }
                  placeholder="Endereço (opcional)"
                />
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={loc.isActive}
                    onChange={(e) =>
                      setLocations((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, isActive: e.target.checked } : row,
                        ),
                      )
                    }
                  />
                  Ativo
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setLocations((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={locations.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
