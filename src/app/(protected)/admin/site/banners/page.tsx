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

type Banner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
  order: number;
  isActive: boolean;
};

export default function BannersPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Banner[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaHref, setCtaHref] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  function resetForm() {
    setTitle("");
    setSubtitle("");
    setCtaLabel("");
    setCtaHref("");
    setImageUrl("");
    setIsActive(true);
    setEditing(null);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site/banners");
      const json = (await res.json()) as ApiResponse<{ items: Banner[] }>;
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

  function openEdit(b: Banner) {
    setEditing(b);
    setTitle(b.title ?? "");
    setSubtitle(b.subtitle ?? "");
    setCtaLabel(b.ctaLabel ?? "");
    setCtaHref(b.ctaHref ?? "");
    setImageUrl(b.imageUrl ?? "");
    setIsActive(b.isActive);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/admin/site/banners/${editing.id}` : "/api/admin/site/banners";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || undefined,
        subtitle: subtitle || undefined,
        ctaLabel: ctaLabel || undefined,
        ctaHref: ctaHref || undefined,
        imageUrl: imageUrl || undefined,
        isActive,
      }),
    });
    const json = (await res.json()) as ApiResponse<{ item: Banner }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
      return;
    }
    toast.push("success", editing ? "Banner atualizado." : "Banner criado.");
    setOpen(false);
    resetForm();
    void load();
  }

  async function remove(b: Banner) {
    if (!confirm("Excluir este banner?")) return;
    const res = await fetch(`/api/admin/site/banners/${b.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Banner excluído.");
    void load();
  }

  const handleReorder = useCallback(
    async (ids: string[]) => {
      const res = await fetch("/api/admin/site/banners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json()) as ApiResponse<{ items: Banner[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message ?? "Falha ao reordenar." : "Falha ao reordenar.");
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
          <div className="text-lg font-semibold">Banners</div>
          <div className="text-sm text-[var(--text-secondary)]">Hero e banners rotativos do site.</div>
        </div>
        <Button onClick={openCreate}>Novo banner</Button>
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
                <Th>Título</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <SortableTableRows items={items} onReorder={handleReorder} noDndWrapper emptyMessage="Nenhum banner cadastrado.">
            {(b) => (
              <>
                <Td>{b.order + 1}</Td>
                <Td>
                  <div className="font-medium text-[var(--text-primary)]">{b.title || "(sem título)"}</div>
                  {b.subtitle && <div className="text-xs text-[var(--text-muted)]">{b.subtitle}</div>}
                </Td>
                <Td>{b.isActive ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openEdit(b)}>Editar</Button>
                    <Button variant="secondary" className="text-red-600" onClick={() => remove(b)}>Excluir</Button>
                  </div>
                </Td>
              </>
            )}
            </SortableTableRows>
          </Table>
        </SortableTableDndWrapper>
      )}

      <Modal open={open} title={editing ? "Editar banner" : "Novo banner"} onClose={() => { setOpen(false); resetForm(); }}>
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Título</label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Subtítulo</label>
            <Input className="mt-1" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Texto do botão (CTA)</label>
            <Input className="mt-1" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Link do botão</label>
            <Input className="mt-1" value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">URL da imagem</label>
            <Input className="mt-1" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            <CloudinaryImageUpload
              kind="banners"
              id={editing?.id}
              currentUrl={imageUrl || undefined}
              onUploaded={setImageUrl}
              label="Ou envie uma imagem"
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <label htmlFor="isActive" className="text-sm">Ativo</label>
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
