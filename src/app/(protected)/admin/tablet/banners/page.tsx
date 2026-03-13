"use client";

import { useCallback, useEffect, useState } from "react";

import { CloudinaryImageUpload } from "@/components/admin/CloudinaryImageUpload";
import { SortableTableDndWrapper, SortableTableRows } from "@/components/admin/SortableTableRows";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type TabletBanner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  order: number;
  isActive: boolean;
};

export default function TabletBannersPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TabletBanner[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TabletBanner | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setTitle("");
    setSubtitle("");
    setImageUrl("");
    setIsActive(true);
    setEditing(null);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tablet/banners");
      const json = (await res.json()) as ApiResponse<{ items: TabletBanner[] }>;
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

  function openEdit(b: TabletBanner) {
    setEditing(b);
    setTitle(b.title ?? "");
    setSubtitle(b.subtitle ?? "");
    setImageUrl(b.imageUrl ?? "");
    setIsActive(b.isActive);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/admin/tablet/banners/${editing.id}` : "/api/admin/tablet/banners";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || undefined,
          subtitle: subtitle || undefined,
          imageUrl: imageUrl || undefined,
          isActive,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ item: TabletBanner }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", editing ? "Banner atualizado." : "Banner criado.");
      setOpen(false);
      resetForm();
      void load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(b: TabletBanner) {
    if (!confirm("Excluir este banner?")) return;
    const res = await fetch(`/api/admin/tablet/banners/${b.id}`, { method: "DELETE" });
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
      const res = await fetch("/api/admin/tablet/banners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json()) as ApiResponse<{ items: TabletBanner[] }>;
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
          <div className="text-lg font-semibold">Banners para tablet</div>
          <div className="text-sm text-[var(--text-secondary)]">
            Banners exibidos apenas na tela de tablet (não aparecem no site).
          </div>
        </div>
        <Button onClick={openCreate}>Novo banner</Button>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
          Nenhum banner cadastrado. Clique em &quot;Novo banner&quot; para começar.
        </div>
      ) : (
        <SortableTableDndWrapper items={items} onReorder={handleReorder}>
          <Table>
            <thead>
              <tr>
                <Th className="w-8" />
                <Th>Ordem</Th>
                <Th>Título</Th>
                <Th>Status</Th>
                <Th>Imagem</Th>
                <Th className="w-40" />
              </tr>
            </thead>
            <SortableTableRows items={items} onReorder={handleReorder} noDndWrapper>
              {(b) => (
                <>
                  <Td>{b.order + 1}</Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-medium text-[var(--text-primary)]">
                        {b.title || "Sem título"}
                      </span>
                      {b.subtitle && (
                        <span className="text-xs text-[var(--text-secondary)] line-clamp-1">
                          {b.subtitle}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={b.isActive ? "green" : "zinc"}>
                      {b.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </Td>
                  <Td>
                    {b.imageUrl ? (
                      <img
                        src={b.imageUrl}
                        alt={b.title ?? ""}
                        className="h-12 w-20 rounded object-cover"
                      />
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">Sem imagem</span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(b)}>
                        Editar
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => remove(b)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Excluir
                      </Button>
                    </div>
                  </Td>
                </>
              )}
            </SortableTableRows>
          </Table>
        </SortableTableDndWrapper>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar banner" : "Novo banner"}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                Título (opcional)
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Promoções do mês"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                Subtítulo (opcional)
              </label>
              <Input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Mensagem complementar"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Imagem
            </label>
            <CloudinaryImageUpload
              kind="banners"
              currentUrl={imageUrl || undefined}
              onUploaded={setImageUrl}
              label="Enviar imagem"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Ativo
            </label>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar banner"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

