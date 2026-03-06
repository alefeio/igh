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

type Testimonial = {
  id: string;
  name: string;
  roleOrContext: string | null;
  quote: string;
  photoUrl: string | null;
  order: number;
  isActive: boolean;
};

type PendingTestimonial = {
  id: string;
  name: string;
  roleOrContext: string | null;
  quote: string;
  photoUrl: string | null;
  status: string;
  createdAt: string;
};

export default function DepoimentosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Testimonial[]>([]);
  const [pending, setPending] = useState<PendingTestimonial[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [name, setName] = useState("");
  const [roleOrContext, setRoleOrContext] = useState("");
  const [quote, setQuote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  function resetForm() {
    setName("");
    setRoleOrContext("");
    setQuote("");
    setPhotoUrl("");
    setIsActive(true);
    setEditing(null);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site/testimonials");
      const json = (await res.json()) as ApiResponse<{ items: Testimonial[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar.");
        return;
      }
      setItems(json.data.items);
    } finally {
      setLoading(false);
    }
  }

  async function loadPending() {
    setPendingLoading(true);
    try {
      const res = await fetch("/api/admin/site/pending-testimonials");
      const json = (await res.json()) as ApiResponse<{ items: PendingTestimonial[] }>;
      if (res.ok && json?.ok) setPending(json.data.items);
    } finally {
      setPendingLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadPending();
  }, []);

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(t: Testimonial) {
    setEditing(t);
    setName(t.name);
    setRoleOrContext(t.roleOrContext ?? "");
    setQuote(t.quote);
    setPhotoUrl(t.photoUrl ?? "");
    setIsActive(t.isActive);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.push("error", "Nome é obrigatório.");
      return;
    }
    if (!quote.trim()) {
      toast.push("error", "Depoimento é obrigatório.");
      return;
    }
    const url = editing ? `/api/admin/site/testimonials/${editing.id}` : "/api/admin/site/testimonials";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        roleOrContext: roleOrContext.trim() || undefined,
        quote: quote.trim(),
        photoUrl: photoUrl.trim() || undefined,
        isActive,
      }),
    });
    const json = (await res.json()) as ApiResponse<{ item: Testimonial }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
      return;
    }
    toast.push("success", editing ? "Depoimento atualizado." : "Depoimento criado.");
    setOpen(false);
    resetForm();
    void load();
    void loadPending();
  }

  async function remove(t: Testimonial) {
    if (!confirm(`Excluir o depoimento de "${t.name}"?`)) return;
    const res = await fetch(`/api/admin/site/testimonials/${t.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Depoimento excluído.");
    void load();
  }

  const handleReorder = useCallback(
    async (ids: string[]) => {
      const res = await fetch("/api/admin/site/testimonials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json()) as ApiResponse<{ items: Testimonial[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", (!json.ok && "error" in json ? json.error.message : null) ?? "Falha ao reordenar.");
        return;
      }
      toast.push("success", "Ordem atualizada.");
      setItems(json.data.items);
    },
    [toast]
  );

  async function approvePending(p: PendingTestimonial) {
    const res = await fetch(`/api/admin/site/pending-testimonials/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    const json = (await res.json()) as ApiResponse<{ message?: string }>;
    if (!res.ok || !json?.ok) {
      toast.push("error", (json && !json.ok && "error" in json ? json.error.message : null) ?? "Falha ao aprovar.");
      return;
    }
    toast.push("success", json.data?.message ?? "Depoimento aprovado.");
    void load();
    void loadPending();
  }

  async function rejectPending(p: PendingTestimonial) {
    if (!confirm(`Rejeitar o depoimento de "${p.name}"?`)) return;
    const res = await fetch(`/api/admin/site/pending-testimonials/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    const json = (await res.json()) as ApiResponse<{ message?: string }>;
    if (!res.ok || !json?.ok) {
      toast.push("error", (json && !json.ok && "error" in json ? json.error.message : null) ?? "Falha ao rejeitar.");
      return;
    }
    toast.push("success", json.data?.message ?? "Depoimento rejeitado.");
    void loadPending();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold">Depoimentos</div>
          <div className="text-sm text-[var(--text-secondary)]">Depoimentos exibidos no site.</div>
        </div>
        <Button onClick={openCreate}>Novo depoimento</Button>
      </div>

      {pending.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Depoimentos pendentes de aprovação</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)] dark:text-[var(--text-muted)]">
            Depoimentos enviados pelo site aguardando sua aprovação para serem publicados.
          </p>
          {pendingLoading ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">Carregando...</p>
          ) : (
            <div className="mt-4 space-y-3">
              {pending.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 rounded border border-[var(--card-border)] bg-[var(--card-bg)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--text-primary)]">{p.name}</p>
                      {p.roleOrContext && (
                        <p className="text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">{p.roleOrContext}</p>
                      )}
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">&ldquo;{p.quote}&rdquo;</p>
                      {p.photoUrl && (
                        <img
                          src={p.photoUrl}
                          alt=""
                          className="mt-2 h-12 w-12 rounded-full object-cover"
                        />
                      )}
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Enviado em {new Date(p.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="primary" size="sm" onClick={() => approvePending(p)}>
                        Aprovar
                      </Button>
                      <Button variant="secondary" className="text-red-600" size="sm" onClick={() => rejectPending(p)}>
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
      ) : (
        <SortableTableDndWrapper items={items} onReorder={handleReorder}>
          <Table>
            <thead>
              <tr>
                <Th className="w-8" />
                <Th>Ordem</Th>
                <Th>Nome</Th>
                <Th>Contexto</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <SortableTableRows items={items} onReorder={handleReorder} noDndWrapper emptyMessage="Nenhum depoimento cadastrado.">
              {(t) => (
                <>
                  <Td>{t.order + 1}</Td>
                  <Td className="font-medium text-[var(--text-primary)]">{t.name}</Td>
                  <Td className="text-sm text-[var(--text-muted)]">{t.roleOrContext ?? "—"}</Td>
                  <Td>{t.isActive ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => openEdit(t)}>Editar</Button>
                      <Button variant="secondary" className="text-red-600" onClick={() => remove(t)}>Excluir</Button>
                    </div>
                  </Td>
                </>
              )}
            </SortableTableRows>
          </Table>
        </SortableTableDndWrapper>
      )}

      <Modal open={open} title={editing ? "Editar depoimento" : "Novo depoimento"} onClose={() => { setOpen(false); resetForm(); }}>
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Nome</label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Cargo / contexto</label>
            <Input className="mt-1" value={roleOrContext} onChange={(e) => setRoleOrContext(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Depoimento</label>
            <textarea className="mt-1 w-full rounded-md border border-[var(--card-border)] px-3 py-2 text-sm" rows={4} value={quote} onChange={(e) => setQuote(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium">URL da foto</label>
            <Input className="mt-1" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." />
            <CloudinaryImageUpload kind="testimonials" currentUrl={photoUrl || undefined} onUploaded={setPhotoUrl} label="Ou envie uma imagem" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="depActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <label htmlFor="depActive" className="text-sm">Ativo</label>
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
