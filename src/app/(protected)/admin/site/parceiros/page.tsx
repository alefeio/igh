"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudinaryImageUpload } from "@/components/admin/CloudinaryImageUpload";
import { SortableTableRows, SortableTableDndWrapper } from "@/components/admin/SortableTableRows";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Partner = {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  order: number;
  isActive: boolean;
};

export default function ParceirosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Partner[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  function resetForm() {
    setName("");
    setLogoUrl("");
    setWebsiteUrl("");
    setIsActive(true);
    setEditing(null);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site/partners");
      const json = (await res.json()) as ApiResponse<{ items: Partner[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar.");
        return;
      }
      setItems(json.data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(p: Partner) {
    setEditing(p);
    setName(p.name);
    setLogoUrl(p.logoUrl ?? "");
    setWebsiteUrl(p.websiteUrl ?? "");
    setIsActive(p.isActive);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.push("error", "Nome é obrigatório.");
      return;
    }
    const url = editing ? `/api/admin/site/partners/${editing.id}` : "/api/admin/site/partners";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        logoUrl: logoUrl.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        isActive,
      }),
    });
    const json = (await res.json()) as ApiResponse<{ item: Partner }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
      return;
    }
    toast.push("success", editing ? "Parceiro atualizado." : "Parceiro criado.");
    setOpen(false);
    resetForm();
    void load();
  }

  async function remove(p: Partner) {
    if (!confirm(`Excluir o parceiro "${p.name}"?`)) return;
    const res = await fetch(`/api/admin/site/partners/${p.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Parceiro excluído.");
    void load();
  }

  const handleReorder = useCallback(
    async (ids: string[]) => {
      const res = await fetch("/api/admin/site/partners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json()) as ApiResponse<{ items: Partner[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao reordenar.");
        return;
      }
      toast.push("success", "Ordem atualizada.");
      setItems(json.data.items);
    },
    [toast]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold">Parceiros</div>
          <div className="text-sm text-[var(--text-secondary)]">Parceiros e apoiadores exibidos no site.</div>
        </div>
        <Button onClick={openCreate}>Novo parceiro</Button>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
      ) : (
        <SortableTableDndWrapper items={items} onReorder={handleReorder}>
          <Table>
            <thead>
              <tr>
                <Th className="w-8" />
                <Th>Ordem</Th>
                <Th>Logo</Th>
                <Th>Nome</Th>
                <Th>Site</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <SortableTableRows items={items} onReorder={handleReorder} noDndWrapper emptyMessage="Nenhum parceiro cadastrado.">
              {(p) => (
                <>
                  <Td>{p.order + 1}</Td>
                  <Td>
                    {p.logoUrl ? (
                      <img src={p.logoUrl} alt="" className="h-10 w-10 rounded object-contain bg-[var(--igh-surface)]" />
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">—</span>
                    )}
                  </Td>
                  <Td className="font-medium text-[var(--text-primary)]">{p.name}</Td>
                  <Td className="text-sm text-[var(--text-muted)]">{p.websiteUrl ?? "—"}</Td>
                  <Td>{p.isActive ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => openEdit(p)}>Editar</Button>
                      <Button variant="secondary" className="text-red-600" onClick={() => remove(p)}>Excluir</Button>
                    </div>
                  </Td>
                </>
              )}
            </SortableTableRows>
          </Table>
        </SortableTableDndWrapper>
      )}

      <Modal open={open} title={editing ? "Editar parceiro" : "Novo parceiro"} onClose={() => { setOpen(false); resetForm(); }}>
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Nome</label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">URL do logo</label>
            <Input className="mt-1" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
            <CloudinaryImageUpload kind="partners" currentUrl={logoUrl || undefined} onUploaded={setLogoUrl} label="Ou envie uma imagem" />
          </div>
          <div>
            <label className="text-sm font-medium">URL do site</label>
            <Input className="mt-1" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="parcActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <label htmlFor="parcActive" className="text-sm">Ativo</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
