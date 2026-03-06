"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudinaryImageUpload } from "@/components/admin/CloudinaryImageUpload";
import { SortableTableRows, SortableTableDndWrapper } from "@/components/admin/SortableTableRows";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiErr, ApiResponse } from "@/lib/api-types";

type Category = {
  id: string;
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
};

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  coverImageUrl: string | null;
  imageUrls: string[];
  categoryId: string | null;
  publishedAt: string | null;
  isPublished: boolean;
  category: { name: string } | null;
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
  const x = typeof d === "string" ? d : (d as Date).toISOString?.()?.slice(0, 10) ?? "";
  return x.slice(0, 10);
}

export default function NoticiasPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  // Modal categoria
  const [catOpen, setCatOpen] = useState(false);
  const [catEditing, setCatEditing] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catOrder, setCatOrder] = useState(0);
  const [catActive, setCatActive] = useState(true);

  // Modal post
  const [postOpen, setPostOpen] = useState(false);
  const [postEditing, setPostEditing] = useState<Post | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postSlug, setPostSlug] = useState("");
  const [postExcerpt, setPostExcerpt] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postCoverUrl, setPostCoverUrl] = useState("");
  const [postImageUrls, setPostImageUrls] = useState<string[]>([]);
  const [postCategoryId, setPostCategoryId] = useState("");
  const [postPublishedAt, setPostPublishedAt] = useState("");
  const [postIsPublished, setPostIsPublished] = useState(false);

  function resetCatForm() {
    setCatName("");
    setCatSlug("");
    setCatOrder(categories.length);
    setCatActive(true);
    setCatEditing(null);
  }

  function resetPostForm() {
    setPostTitle("");
    setPostSlug("");
    setPostExcerpt("");
    setPostContent("");
    setPostCoverUrl("");
    setPostImageUrls([]);
    setPostCategoryId("");
    setPostPublishedAt("");
    setPostIsPublished(false);
    setPostEditing(null);
  }

  async function load() {
    setLoading(true);
    try {
      const [catRes, postRes] = await Promise.all([
        fetch("/api/admin/site/news/categories"),
        fetch("/api/admin/site/news/posts"),
      ]);
      const catJson = (await catRes.json()) as ApiResponse<{ items: Category[] }>;
      const postJson = (await postRes.json()) as ApiResponse<{ items: Post[] }>;
      if (!catRes.ok || !catJson.ok) {
        toast.push("error", !catJson.ok ? (catJson as ApiErr).error.message : "Falha ao carregar categorias.");
        return;
      }
      if (!postRes.ok || !postJson.ok) {
        toast.push("error", !postJson.ok ? (postJson as ApiErr).error.message : "Falha ao carregar posts.");
        return;
      }
      setCategories(catJson.data.items);
      setPosts(postJson.data.items);
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
    const slugVal = catSlug.trim() || slugify(catName);
    const url = catEditing
      ? `/api/admin/site/news/categories/${catEditing.id}`
      : "/api/admin/site/news/categories";
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
  }

  async function removeCategory(c: Category) {
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
    const res = await fetch(`/api/admin/site/news/categories/${c.id}`, { method: "DELETE" });
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
      const res = await fetch("/api/admin/site/news/categories", {
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

  const openPostCreate = () => {
    resetPostForm();
    setPostCategoryId(categories[0]?.id ?? "");
    setPostOpen(true);
  };

  const openPostEdit = (p: Post) => {
    setPostEditing(p);
    setPostTitle(p.title);
    setPostSlug(p.slug);
    setPostExcerpt(p.excerpt ?? "");
    setPostContent(p.content ?? "");
    setPostCoverUrl(p.coverImageUrl ?? "");
    setPostImageUrls(p.imageUrls ?? []);
    setPostCategoryId(p.categoryId ?? "");
    setPostPublishedAt(dateToInput(p.publishedAt));
    setPostIsPublished(p.isPublished);
    setPostOpen(true);
  };

  const onPostTitleChange = (v: string) => {
    setPostTitle(v);
    if (!postEditing) setPostSlug(slugify(v));
  };

  async function savePost(e: React.FormEvent) {
    e.preventDefault();
    if (!postTitle.trim()) {
      toast.push("error", "Título é obrigatório.");
      return;
    }
    const slugVal = postSlug.trim() || slugify(postTitle);
    const url = postEditing
      ? `/api/admin/site/news/posts/${postEditing.id}`
      : "/api/admin/site/news/posts";
    const method = postEditing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: postTitle.trim(),
        slug: slugVal,
        excerpt: postExcerpt.trim() || undefined,
        content: postContent.trim() || undefined,
        coverImageUrl: postCoverUrl.trim() || undefined,
        imageUrls: postImageUrls,
        categoryId: postCategoryId || null,
        publishedAt: postPublishedAt || null,
        isPublished: postIsPublished,
      }),
    });
    const json = (await res.json()) as ApiResponse<{ item: Post }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao salvar.");
      return;
    }
    toast.push("success", postEditing ? "Post atualizado." : "Post criado.");
    setPostOpen(false);
    resetPostForm();
    void load();
  }

  async function removePost(p: Post) {
    if (!confirm(`Excluir o post "${p.title}"?`)) return;
    const res = await fetch(`/api/admin/site/news/posts/${p.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Post excluído.");
    void load();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="text-lg font-semibold">Notícias</div>
        <div className="text-sm text-[var(--text-secondary)]">Categorias e posts exibidos na página Notícias do site.</div>
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

      {/* Posts */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Posts</h3>
          <Button onClick={openPostCreate}>Novo post</Button>
        </div>
        {loading ? (
          <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Título</Th>
                <Th>Categoria</Th>
                <Th>Publicação</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-[var(--card-border)]">
                  <Td className="font-medium text-[var(--text-primary)]">{p.title}</Td>
                  <Td className="text-sm text-[var(--text-muted)]">{p.category?.name ?? "—"}</Td>
                  <Td className="text-sm text-[var(--text-muted)]">{dateToInput(p.publishedAt) || "—"}</Td>
                  <Td>
                    {p.isPublished ? (
                      <Badge tone="green">Publicado</Badge>
                    ) : (
                      <Badge tone="amber">Rascunho</Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => openPostEdit(p)}>Editar</Button>
                      <Button variant="secondary" className="text-red-600" onClick={() => removePost(p)}>Excluir</Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
            {posts.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm text-[var(--text-muted)]">
                    Nenhum post.
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
            <Input className="mt-1" value={catSlug} onChange={(e) => setCatSlug(e.target.value)} placeholder="ex: cursos" />
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

      <Modal open={postOpen} title={postEditing ? "Editar post" : "Novo post"} onClose={() => { setPostOpen(false); resetPostForm(); }}>
        <form className="flex flex-col gap-3" onSubmit={savePost}>
          <div>
            <label className="text-sm font-medium">Título</label>
            <Input className="mt-1" value={postTitle} onChange={(e) => onPostTitleChange(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Slug (URL)</label>
            <Input className="mt-1" value={postSlug} onChange={(e) => setPostSlug(e.target.value)} placeholder="ex: meu-post" />
          </div>
          <div>
            <label className="text-sm font-medium">Categoria</label>
            <select
              className="theme-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={postCategoryId}
              onChange={(e) => setPostCategoryId(e.target.value)}
            >
              <option value="">Nenhuma</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Resumo / excerpt</label>
            <textarea
              className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              rows={2}
              value={postExcerpt}
              onChange={(e) => setPostExcerpt(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Conteúdo (rich text)</label>
            <div className="mt-1">
              <RichTextEditor
                value={postContent}
                onChange={setPostContent}
                placeholder="Digite o conteúdo da notícia..."
                minHeight="160px"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">URL da imagem de capa</label>
            <Input className="mt-1" value={postCoverUrl} onChange={(e) => setPostCoverUrl(e.target.value)} placeholder="https://..." />
            <CloudinaryImageUpload kind="news" currentUrl={postCoverUrl || undefined} onUploaded={setPostCoverUrl} label="Ou envie uma imagem" />
          </div>
          <div>
            <label className="text-sm font-medium">Imagens adicionais (galeria / carrossel)</label>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Ordem da lista = ordem no carrossel. Use a imagem de capa acima ou adicione aqui.</p>
            <ul className="mt-2 list-none space-y-2 pl-0">
              {postImageUrls.map((url, idx) => (
                <li key={idx} className="flex items-center gap-2 rounded border border-[var(--card-border)] bg-[var(--igh-surface)] p-2">
                  <img src={url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                  <Input className="min-w-0 flex-1 text-sm" value={url} onChange={(e) => setPostImageUrls((prev) => prev.map((u, i) => (i === idx ? e.target.value : u)))} placeholder="URL" />
                  <Button type="button" variant="secondary" className="shrink-0 text-red-600" onClick={() => setPostImageUrls((prev) => prev.filter((_, i) => i !== idx))}>Remover</Button>
                </li>
              ))}
            </ul>
            <div className="mt-2">
              <CloudinaryImageUpload kind="news" currentUrl={undefined} onUploaded={(url) => setPostImageUrls((prev) => [...prev, url])} label="Adicionar imagem" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Data de publicação</label>
            <Input type="date" className="mt-1" value={postPublishedAt} onChange={(e) => setPostPublishedAt(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="postPublished" checked={postIsPublished} onChange={(e) => setPostIsPublished(e.target.checked)} />
            <label htmlFor="postPublished" className="text-sm">Publicado (visível no site)</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setPostOpen(false); resetPostForm(); }}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
