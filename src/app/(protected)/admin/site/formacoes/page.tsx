"use client";

import { useCallback, useEffect, useState } from "react";
import { SortableTableRows, SortableTableDndWrapper } from "@/components/admin/SortableTableRows";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Formation = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  audience: string | null;
  outcomes: string[];
  finalProject: string | null;
  prerequisites: string | null;
  order: number;
  isActive: boolean;
  courses: { course: { id: string; name: string; slug: string } }[];
};

type CourseOption = { id: string; name: string; slug: string };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function FormacoesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Formation[]>([]);
  const [allCourses, setAllCourses] = useState<CourseOption[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Formation | null>(null);
  const [courseFilter, setCourseFilter] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [audience, setAudience] = useState("");
  const [outcomesText, setOutcomesText] = useState("");
  const [finalProject, setFinalProject] = useState("");
  const [prerequisites, setPrerequisites] = useState("");
  const [order, setOrder] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  function resetForm() {
    setTitle("");
    setSlug("");
    setSummary("");
    setAudience("");
    setOutcomesText("");
    setFinalProject("");
    setPrerequisites("");
    setOrder("");
    setIsActive(true);
    setSelectedCourseIds([]);
    setEditing(null);
  }

  async function load() {
    setLoading(true);
    try {
      const [formationsRes, coursesRes] = await Promise.all([
        fetch("/api/admin/site/formations"),
        fetch("/api/courses"),
      ]);
      const formationsJson = (await formationsRes.json()) as ApiResponse<{ items: Formation[] }>;
      const coursesJson = (await coursesRes.json()) as ApiResponse<{ courses: CourseOption[] }>;
      if (!formationsRes.ok || !formationsJson.ok) {
        toast.push("error", !formationsJson.ok ? formationsJson.error?.message : "Falha ao carregar formações.");
        return;
      }
      setItems(formationsJson.data.items);
      if (coursesRes.ok && coursesJson.ok) {
        setAllCourses(coursesJson.data.courses);
      }
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

  function openEdit(item: Formation) {
    setEditing(item);
    setTitle(item.title);
    setSlug(item.slug);
    setSummary(item.summary ?? "");
    setAudience(item.audience ?? "");
    setOutcomesText(item.outcomes.join("\n"));
    setFinalProject(item.finalProject ?? "");
    setPrerequisites(item.prerequisites ?? "");
    setOrder(item.order.toString());
    setIsActive(item.isActive);
    setSelectedCourseIds(item.courses.map((c) => c.course.id));
    setOpen(true);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!editing) setSlug(slugify(value));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.push("error", "Título é obrigatório.");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const finalSlug = slug.trim() || slugify(title);
      const outcomes = outcomesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        title: title.trim(),
        slug: finalSlug,
        summary: summary.trim() || undefined,
        audience: audience.trim() || undefined,
        outcomes,
        finalProject: finalProject.trim() || undefined,
        prerequisites: prerequisites.trim() || undefined,
        order: order.trim() !== "" ? parseInt(order, 10) : undefined,
        isActive,
        courseIds: selectedCourseIds,
      };

      const url = editing ? `/api/admin/site/formations/${editing.id}` : "/api/admin/site/formations";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResponse<{ item: Formation }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message ?? "Falha ao salvar." : "Falha ao salvar.");
        return;
      }
      toast.push("success", editing ? "Formação atualizada." : "Formação criada.");
      setOpen(false);
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Formation) {
    if (!confirm(`Excluir a formação "${item.title}"? Os vínculos com cursos serão removidos.`)) return;
    const res = await fetch(`/api/admin/site/formations/${item.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error?.message ?? "Falha ao excluir." : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Formação excluída.");
    await load();
  }

  const handleReorder = useCallback(
    async (ids: string[]) => {
      const res = await fetch("/api/admin/site/formations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json()) as ApiResponse<{ items: Formation[] }>;
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
            <div className="text-lg font-semibold">Formações</div>
            <div className="text-sm text-[var(--text-secondary)]">Trilhas vinculadas aos cursos. Use no filtro da página Formações do site.</div>
          </div>
          <Button onClick={openCreate}>Nova formação</Button>
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
                <Th>Slug</Th>
                <Th>Status</Th>
                <Th>Cursos</Th>
                <Th />
              </tr>
            </thead>
            <SortableTableRows items={items} onReorder={handleReorder} noDndWrapper emptyMessage="Nenhuma formação cadastrada.">
              {(item) => (
              <>
                <Td>{item.order + 1}</Td>
                <Td className="font-medium text-[var(--text-primary)]">{item.title}</Td>
                <Td className="text-sm text-[var(--text-secondary)]">{item.slug}</Td>
                <Td>{item.isActive ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}</Td>
                <Td>{item.courses.length}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openEdit(item)}>
                      Editar
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => remove(item)}
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

      <Modal open={open} title={editing ? "Editar formação" : "Nova formação"} onClose={() => { setOpen(false); resetForm(); }}>
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Título</label>
            <Input className="mt-1" value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Ex: Programação" />
          </div>
          <div>
            <label className="text-sm font-medium">Slug (URL)</label>
            <Input className="mt-1" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Ex: programacao" />
          </div>
          <div>
            <label className="text-sm font-medium">Resumo (opcional)</label>
            <Input className="mt-1" value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Público-alvo (opcional)</label>
            <Input className="mt-1" value={audience} onChange={(e) => setAudience(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">O que se aprende (um por linha, opcional)</label>
            <textarea
              className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              rows={4}
              value={outcomesText}
              onChange={(e) => setOutcomesText(e.target.value)}
              placeholder="Lógica de programação&#10;HTML e CSS&#10;..."
            />
          </div>
          <div>
            <label className="text-sm font-medium">Entrega final (opcional)</label>
            <Input className="mt-1" value={finalProject} onChange={(e) => setFinalProject(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Pré-requisitos (opcional)</label>
            <Input className="mt-1" value={prerequisites} onChange={(e) => setPrerequisites(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Ordem</label>
            <Input className="mt-1" type="number" min={0} value={order} onChange={(e) => setOrder(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="formActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <label htmlFor="formActive" className="text-sm">Ativo</label>
          </div>
          <div>
            <label className="text-sm font-medium">Cursos desta formação</label>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Marque os cursos e defina a ordem (o primeiro da lista é o primeiro da trilha; use as setas para ajustar).
            </p>
            <div className="mt-2">
              <Input
                placeholder="Filtrar por nome..."
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-40 overflow-y-auto rounded border border-[var(--card-border)] p-2">
                {allCourses
                  .filter((c) => !courseFilter.trim() || c.name.toLowerCase().includes(courseFilter.toLowerCase()))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedCourseIds((prev) => [...prev, c.id]);
                          else setSelectedCourseIds((prev) => prev.filter((id) => id !== c.id));
                        }}
                      />
                      <span className="text-[var(--text-primary)]">{c.name}</span>
                    </label>
                  ))}
                {allCourses.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)]">Nenhum curso cadastrado. Cadastre em Cursos.</p>
                )}
              </div>
            </div>
            {selectedCourseIds.length > 0 && (
              <div className="mt-3">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Ordem dos cursos (primeiro = início da trilha):</span>
                <ul className="mt-1 rounded border border-[var(--card-border)] bg-[var(--igh-surface)] p-2">
                  {selectedCourseIds.map((courseId, index) => {
                    const course = allCourses.find((c) => c.id === courseId);
                    const name = course?.name ?? courseId;
                    return (
                      <li
                        key={courseId}
                        className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1.5 text-sm shadow-sm"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {index + 1}. {name}
                        </span>
                        <span className="flex shrink-0 gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (index <= 0) return;
                              setSelectedCourseIds((prev) => {
                                const next = [...prev];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                return next;
                              });
                            }}
                            disabled={index === 0}
                            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] disabled:opacity-40"
                            title="Subir"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (index >= selectedCourseIds.length - 1) return;
                              setSelectedCourseIds((prev) => {
                                const next = [...prev];
                                [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                return next;
                              });
                            }}
                            disabled={index === selectedCourseIds.length - 1}
                            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--igh-surface)] disabled:opacity-40"
                            title="Descer"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando" : "Salvar"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
