"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudinaryFileUpload } from "@/components/admin/CloudinaryFileUpload";
import { SortableTableRows, SortableTableDndWrapper } from "@/components/admin/SortableTableRows";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiErr, ApiResponse } from "@/lib/api-types";

type Category = {
  id: string;
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
};

type Document = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  date: string | null;
  fileUrl: string | null;
  isActive: boolean;
  category: { name: string };
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function dateToInput(d: string | Date | null): string {
  if (!d) return "";
  const x = typeof d === "string" ? d : d.toISOString().slice(0, 10);
  return x.slice(0, 10);
}

export default function TransparenciaPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  // Modal categoria
  const [catOpen, setCatOpen] = useState(false);
  const [catEditing, setCatEditing] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catOrder, setCatOrder] = useState(0);
  const [catActive, setCatActive] = useState(true);

  // Modal documento
  const [docOpen, setDocOpen] = useState(false);
  const [docEditing, setDocEditing] = useState<Document | null>(null);
  const [docCategoryId, setDocCategoryId] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [docDate, setDocDate] = useState("");
  const [docFileUrl, setDocFileUrl] = useState("");
  const [docActive, setDocActive] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);

  function resetCatForm() {
    setCatName("");
    setCatSlug("");
    setCatOrder(categories.length);
    setCatActive(true);
    setCatEditing(null);
  }

  function resetDocForm() {
    setDocCategoryId(categories[0]?.id ?? "");
    setDocTitle("");
    setDocDescription("");
    setDocDate("");
    setDocFileUrl("");
    setDocActive(true);
    setDocEditing(null);
  }

  async function load() {
    setLoading(true);
    try {
      const [catRes, docRes] = await Promise.all([
        fetch("/api/admin/site/transparency/categories"),
        fetch("/api/admin/site/transparency/documents"),
      ]);
      const catJson = (await catRes.json()) as ApiResponse<{ items: Category[] }>;
      const docJson = (await docRes.json()) as ApiResponse<{ items: Document[] }>;
      if (!catRes.ok || !catJson.ok) {
        toast.push("error", !catJson.ok ? (catJson as ApiErr).error.message : "Falha ao carregar categorias.");
        return;
      }
      if (!docRes.ok || !docJson.ok) {
        toast.push("error", !docJson.ok ? (docJson as ApiErr).error.message : "Falha ao carregar documentos.");
        return;
      }
      setCategories(catJson.data.items);
      setDocuments(docJson.data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const openCatCreate = () => {
    resetCatForm();
    setCatOrder(categories.length);
    setCatOpen(true);
  };

  const openCatEdit = (c: Category) => {
    setCatEditing(c);
    setCatName(c.name);
    setCatSlug(c.slug);
    setCatOrder(c.order);
    setCatActive(c.isActive);
    setCatOpen(true);
  };

  const onCatNameChange = (v: string) => {
    setCatName(v);
    if (!catEditing) setCatSlug(slugify(v));
  };

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) {
      toast.push("error", "Nome é obrigatório.");
      return;
    }
    if (savingCategory) return;
    setSavingCategory(true);
    try {
      const slugVal = catSlug.trim() || slugify(catName);
      const url = catEditing
        ? `/api/admin/site/transparency/categories/${catEditing.id}`
        : "/api/admin/site/transparency/categories";
      const method = catEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catName.trim(),
          slug: slugVal,
          order: catOrder,
          isActive: catActive,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ item: Category }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", catEditing ? "Categoria atualizada." : "Categoria criada.");
      setCatOpen(false);
      resetCatForm();
      void load();
    } finally {
      setSavingCategory(false);
    }
  }

  async function removeCategory(c: Category) {
    if (!confirm(`Excluir a categoria "${c.name}"? Documentos vinculados ficarão sem categoria.`)) return;
    const res = await fetch(`/api/admin/site/transparency/categories/${c.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Categoria excluída.");
    void load();
  }

  const handleCatReorder = useCallback(
    async (ids: string[]) => {
      const res = await fetch("/api/admin/site/transparency/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json()) as ApiResponse<{ items: Category[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao reordenar.");
        return;
      }
      toast.push("success", "Ordem atualizada.");
      setCategories(json.data.items);
    },
    [toast]
  );

  const openDocCreate = () => {
    resetDocForm();
    setDocCategoryId(categories[0]?.id ?? "");
    setDocOpen(true);
  };

  const openDocEdit = (d: Document) => {
    setDocEditing(d);
    setDocCategoryId(d.categoryId);
    setDocTitle(d.title);
    setDocDescription(d.description ?? "");
    setDocDate(dateToInput(d.date));
    setDocFileUrl(d.fileUrl ?? "");
    setDocActive(d.isActive);
    setDocOpen(true);
  };

  async function saveDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!docTitle.trim()) {
      toast.push("error", "Título é obrigatório.");
      return;
    }
    if (!docCategoryId) {
      toast.push("error", "Selecione uma categoria.");
      return;
    }
    if (savingDocument) return;
    setSavingDocument(true);
    try {
      const url = docEditing
        ? `/api/admin/site/transparency/documents/${docEditing.id}`
        : "/api/admin/site/transparency/documents";
      const method = docEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: docCategoryId,
          title: docTitle.trim(),
          description: docDescription.trim() || undefined,
          date: docDate || null,
          fileUrl: docFileUrl.trim() || undefined,
          isActive: docActive,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ item: Document }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", docEditing ? "Documento atualizado." : "Documento criado.");
      setDocOpen(false);
      resetDocForm();
      void load();
    } finally {
      setSavingDocument(false);
    }
  }

  async function removeDocument(d: Document) {
    if (!confirm(`Excluir o documento "${d.title}"?`)) return;
    const res = await fetch(`/api/admin/site/transparency/documents/${d.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Documento excluído.");
    void load();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="text-lg font-semibold">Transparência</div>
        <div className="text-sm text-[var(--text-secondary)]">Categorias e documentos exibidos na página Transparência do site.</div>
      </div>

      {/* Categorias */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Categorias</h3>
          <Button onClick={openCatCreate}>Nova categoria</Button>
        </div>
        {loading ? (
          <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
        ) : (
          <SortableTableDndWrapper items={categories} onReorder={handleCatReorder}>
            <Table>
              <thead>
                <tr>
                  <Th className="w-8" />
                  <Th>Ordem</Th>
                  <Th>Nome</Th>
                  <Th>Slug</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <SortableTableRows
                items={categories}
                onReorder={handleCatReorder}
                noDndWrapper
                emptyMessage="Nenhuma categoria."
              >
                {(c) => (
                  <>
                    <Td>{c.order + 1}</Td>
                    <Td className="font-medium text-[var(--text-primary)]">{c.name}</Td>
                    <Td className="text-sm text-[var(--text-muted)]">{c.slug}</Td>
                    <Td>{c.isActive ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}</Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => openCatEdit(c)}>Editar</Button>
                        <Button variant="secondary" className="text-red-600" onClick={() => removeCategory(c)}>Excluir</Button>
                      </div>
                    </Td>
                  </>
                )}
              </SortableTableRows>
            </Table>
          </SortableTableDndWrapper>
        )}
      </div>

      {/* Documentos */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Documentos</h3>
          <Button onClick={openDocCreate} disabled={categories.length === 0}>
            Novo documento
          </Button>
        </div>
        {categories.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">Crie uma categoria antes de adicionar documentos.</p>
        )}
        {!loading && categories.length > 0 && (
          <Table>
            <thead>
              <tr>
                <Th>Título</Th>
                <Th>Categoria</Th>
                <Th>Data</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-b border-[var(--card-border)]">
                  <Td className="font-medium text-[var(--text-primary)]">{d.title}</Td>
                  <Td className="text-sm text-[var(--text-muted)]">{d.category.name}</Td>
                  <Td className="text-sm text-[var(--text-muted)]">{dateToInput(d.date) || "—"}</Td>
                  <Td>{d.isActive ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => openDocEdit(d)}>Editar</Button>
                      <Button variant="secondary" className="text-red-600" onClick={() => removeDocument(d)}>Excluir</Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
            {documents.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm text-[var(--text-muted)]">
                    Nenhum documento.
                  </td>
                </tr>
              </tbody>
            )}
          </Table>
        )}
      </div>

      <Modal open={catOpen} title={catEditing ? "Editar categoria" : "Nova categoria"} onClose={() => { setCatOpen(false); resetCatForm(); }}>
        <form className="flex flex-col gap-3" onSubmit={saveCategory}>
          <div>
            <label className="text-sm font-medium">Nome</label>
            <Input className="mt-1" value={catName} onChange={(e) => onCatNameChange(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Slug</label>
            <Input className="mt-1" value={catSlug} onChange={(e) => setCatSlug(e.target.value)} placeholder="ex: editais" />
          </div>
          <div>
            <label className="text-sm font-medium">Ordem</label>
            <Input type="number" min={0} className="mt-1" value={catOrder} onChange={(e) => setCatOrder(parseInt(e.target.value, 10) || 0)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="catActive" checked={catActive} onChange={(e) => setCatActive(e.target.checked)} />
            <label htmlFor="catActive" className="text-sm">Ativo</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setCatOpen(false); resetCatForm(); }}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={docOpen} title={docEditing ? "Editar documento" : "Novo documento"} onClose={() => { setDocOpen(false); resetDocForm(); }}>
        <form className="flex flex-col gap-3" onSubmit={saveDocument}>
          <div>
            <label className="text-sm font-medium">Categoria</label>
            <select
              className="theme-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={docCategoryId}
              onChange={(e) => setDocCategoryId(e.target.value)}
            >
              <option value="">Selecione</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Título</label>
            <Input className="mt-1" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <textarea
              className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              rows={2}
              value={docDescription}
              onChange={(e) => setDocDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Data</label>
            <Input type="date" className="mt-1" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">URL do arquivo (PDF)</label>
            <Input className="mt-1" value={docFileUrl} onChange={(e) => setDocFileUrl(e.target.value)} placeholder="https://..." />
            <CloudinaryFileUpload
              kind="transparency"
              id={docEditing?.id}
              currentUrl={docFileUrl || undefined}
              onUploaded={setDocFileUrl}
              label="Ou envie um PDF"
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="docActive" checked={docActive} onChange={(e) => setDocActive(e.target.checked)} />
            <label htmlFor="docActive" className="text-sm">Ativo</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setDocOpen(false); resetDocForm(); }}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
