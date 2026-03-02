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

type Project = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  coverImageUrl: string | null;
  order: number;
  isActive: boolean;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function ProjetosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  function resetForm() {
    setTitle("");
    setSlug("");
    setSummary("");
    setContent("");
    setCoverImageUrl("");
    setIsActive(true);
    setEditing(null);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site/projects");
      const json = (await res.json()) as ApiResponse<{ items: Project[] }>;
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

  function openEdit(p: Project) {
    setEditing(p);
    setTitle(p.title);
    setSlug(p.slug);
    setSummary(p.summary ?? "");
    setContent(p.content ?? "");
    setCoverImageUrl(p.coverImageUrl ?? "");
    setIsActive(p.isActive);
    setOpen(true);
  }

  function onTitleChange(v: string) {
    setTitle(v);
    if (!editing) setSlug(slugify(v));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.push("error", "Título é obrigatório.");
      return;
    }
    const slugVal = slug.trim() || slugify(title);
    const url = editing ? `/api/admin/site/projects/${editing.id}` : "/api/admin/site/projects";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        slug: slugVal,
        summary: summary.trim() || undefined,
        content: content.trim() || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined,
        isActive,
      }),
    });
    const json = (await res.json()) as ApiResponse<{ item: Project }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
      return;
    }
    toast.push("success", editing ? "Projeto atualizado." : "Projeto criado.");
    setOpen(false);
    resetForm();
    void load();
  }

  async function remove(p: Project) {
    if (!confirm(`Excluir o projeto "${p.title}"?`)) return;
    const res = await fetch(`/api/admin/site/projects/${p.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Projeto excluído.");
    void load();
  }

  const handleReorder = useCallback(
    async (ids: string[]) => {
      const res = await fetch("/api/admin/site/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json()) as ApiResponse<{ items: Project[] }>;
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
          <div className="text-lg font-semibold">Projetos</div>
          <div className="text-sm text-zinc-600">Projetos exibidos na página Projetos do site.</div>
        </div>
        <Button onClick={openCreate}>Novo projeto</Button>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-600">Carregando...</div>
      ) : (
        <SortableTableDndWrapper items={items} onReorder={handleReorder}>
          <Table>
            <thead>
              <tr>
                <Th className="w-8" />
                <Th>Ordem</Th>
                <Th>Título</Th>
                <Th>Slug</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <SortableTableRows items={items} onReorder={handleReorder} noDndWrapper emptyMessage="Nenhum projeto cadastrado.">
              {(p) => (
                <>
                  <Td>{p.order + 1}</Td>
                  <Td className="font-medium text-zinc-900">{p.title}</Td>
                  <Td className="text-sm text-zinc-500">{p.slug}</Td>
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

      <Modal open={open} title={editing ? "Editar projeto" : "Novo projeto"} onClose={() => { setOpen(false); resetForm(); }}>
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Título</label>
            <Input className="mt-1" value={title} onChange={(e) => onTitleChange(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Slug (URL)</label>
            <Input className="mt-1" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: meu-projeto" />
          </div>
          <div>
            <label className="text-sm font-medium">Resumo</label>
            <Input className="mt-1" value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Conteúdo</label>
            <textarea className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">URL da imagem de capa</label>
            <Input className="mt-1" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." />
            <CloudinaryImageUpload kind="projects" currentUrl={coverImageUrl || undefined} onUploaded={setCoverImageUrl} label="Ou envie uma imagem" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="projActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <label htmlFor="projActive" className="text-sm">Ativo</label>
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
