"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CloudinaryImageUpload } from "@/components/admin/CloudinaryImageUpload";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Course = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  content: string | null;
  imageUrl: string | null;
  workloadHours: number | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
};

type Lesson = { id: string; title: string; order: number; durationMinutes: number | null; videoUrl?: string | null; imageUrls?: string[]; contentRich?: string | null };
type ModuleWithLessons = { id: string; title: string; description: string | null; order: number; lessons: Lesson[] };

export default function CoursesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [workloadHours, setWorkloadHours] = useState<string>("");
  const [status, setStatus] = useState<Course["status"]>("ACTIVE");
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [moduleModal, setModuleModal] = useState<{ type: "create" | "edit"; module?: ModuleWithLessons } | null>(null);
  const [lessonModal, setLessonModal] = useState<{ type: "create" | "edit"; module: ModuleWithLessons; lesson?: Lesson } | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: "", description: "", order: 0 });
  const [lessonForm, setLessonForm] = useState({ title: "", order: 0, durationMinutes: "" as string | number, videoUrl: "", imageUrls: [] as string[], contentRich: "" });
  const [savingCourse, setSavingCourse] = useState(false);
  const [savingModule, setSavingModule] = useState(false);
  const [savingLesson, setSavingLesson] = useState(false);

  const canSubmit = useMemo(() => name.trim().length >= 2, [name]);

  function resetForm() {
    setName("");
    setDescription("");
    setContent("");
    setImageUrl("");
    setWorkloadHours("");
    setStatus("ACTIVE");
    setEditing(null);
    setModules([]);
    setModuleModal(null);
    setLessonModal(null);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(c: Course) {
    setEditing(c);
    setName(c.name);
    setDescription(c.description ?? "");
    setContent(c.content ?? "");
    setImageUrl(c.imageUrl ?? "");
    setWorkloadHours(c.workloadHours?.toString() ?? "");
    setStatus(c.status);
    setModules([]);
    setModuleModal(null);
    setLessonModal(null);
    setOpen(true);
    setModulesLoading(true);
    fetch(`/api/courses/${c.id}/modules`)
      .then(async (r) => {
        const text = await r.text();
        if (!text.trim()) return { ok: false as const, data: { modules: [] as ModuleWithLessons[] } };
        try {
          return JSON.parse(text) as ApiResponse<{ modules: ModuleWithLessons[] }>;
        } catch {
          return { ok: false as const, data: { modules: [] as ModuleWithLessons[] } };
        }
      })
      .then((json) => {
        if (json.ok && json.data?.modules) setModules(json.data.modules);
      })
      .catch(() => setModules([]))
      .finally(() => setModulesLoading(false));
  }

  async function refetchModules() {
    if (!editing?.id) return;
    setModulesLoading(true);
    try {
      const r = await fetch(`/api/courses/${editing.id}/modules`);
      const text = await r.text();
      if (!text.trim()) return;
      const json = JSON.parse(text) as ApiResponse<{ modules: ModuleWithLessons[] }>;
      if (json.ok && json.data?.modules) setModules(json.data.modules);
    } catch {
      setModules([]);
    } finally {
      setModulesLoading(false);
    }
  }

  function openModuleCreate() {
    setModuleForm({ title: "", description: "", order: modules.length });
    setModuleModal({ type: "create" });
  }

  function openModuleEdit(mod: ModuleWithLessons) {
    setModuleForm({ title: mod.title, description: mod.description ?? "", order: mod.order });
    setModuleModal({ type: "edit", module: mod });
  }

  async function saveModule(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.id || !moduleForm.title.trim() || savingModule) return;
    setSavingModule(true);
    try {
      const isEdit = moduleModal?.type === "edit" && moduleModal?.module;
      const url = isEdit
        ? `/api/courses/${editing.id}/modules/${moduleModal!.module!.id}`
        : `/api/courses/${editing.id}/modules`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: moduleForm.title.trim(),
          description: moduleForm.description.trim() || undefined,
          order: moduleForm.order,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ modules: ModuleWithLessons[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Erro" : "Falha ao salvar módulo.");
        return;
      }
      toast.push("success", isEdit ? "Módulo atualizado." : "Módulo criado.");
      if (json.data?.modules) setModules(json.data.modules);
      setModuleModal(null);
    } finally {
      setSavingModule(false);
    }
  }

  async function deleteModule(mod: ModuleWithLessons) {
    if (!editing?.id || !confirm(`Excluir o módulo "${mod.title}" e todas as suas aulas?`)) return;
    const res = await fetch(`/api/courses/${editing.id}/modules/${mod.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ modules: ModuleWithLessons[] }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Erro" : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Módulo excluído.");
    if (json.data?.modules) setModules(json.data.modules);
    setModuleModal(null);
  }

  function openLessonCreate(mod: ModuleWithLessons) {
    setLessonForm({ title: "", order: mod.lessons.length, durationMinutes: "", videoUrl: "", imageUrls: [], contentRich: "" });
    setLessonModal({ type: "create", module: mod });
  }

  function openLessonEdit(mod: ModuleWithLessons, les: Lesson) {
    setLessonForm({
      title: les.title,
      order: les.order,
      durationMinutes: les.durationMinutes ?? "",
      videoUrl: les.videoUrl ?? "",
      imageUrls: les.imageUrls ?? [],
      contentRich: les.contentRich ?? "",
    });
    setLessonModal({ type: "edit", module: mod, lesson: les });
  }

  async function saveLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.id || !lessonModal || !lessonForm.title.trim() || savingLesson) return;
    setSavingLesson(true);
    try {
      const mod = lessonModal.module;
      const isEdit = lessonModal.type === "edit" && lessonModal.lesson;
      const url = isEdit
        ? `/api/courses/${editing.id}/modules/${mod.id}/lessons/${lessonModal.lesson!.id}`
        : `/api/courses/${editing.id}/modules/${mod.id}/lessons`;
      const method = isEdit ? "PATCH" : "POST";
      const duration = lessonForm.durationMinutes === "" ? null : Number(lessonForm.durationMinutes);
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: lessonForm.title.trim(),
          order: Number(lessonForm.order) || 0,
          durationMinutes: duration,
          videoUrl: lessonForm.videoUrl?.trim() || null,
          imageUrls: lessonForm.imageUrls ?? [],
          contentRich: lessonForm.contentRich?.trim() || null,
        }),
      });
      const text = await res.text();
      let json: ApiResponse<{ modules: ModuleWithLessons[] }>;
      try {
        json = (text ? JSON.parse(text) : { ok: false }) as ApiResponse<{ modules: ModuleWithLessons[] }>;
      } catch {
        if (!res.ok) {
          toast.push("error", res.status === 404 ? "Aula não encontrada. Recarregue a página e tente novamente." : `Erro ao salvar (${res.status}).`);
          return;
        }
        json = { ok: false } as ApiResponse<{ modules: ModuleWithLessons[] }>;
      }
      if (!res.ok || !json.ok) {
        const errMsg = json && !(json as { ok?: boolean }).ok && "error" in json ? (json as { error?: { message?: string } }).error?.message : null;
        toast.push("error", errMsg ?? (res.status === 404 ? "Aula não encontrada. Recarregue a página." : "Falha ao salvar aula."));
        return;
      }
      toast.push("success", isEdit ? "Aula atualizada." : "Aula criada.");
      if (json.data?.modules) setModules(json.data.modules);
      setLessonModal(null);
    } finally {
      setSavingLesson(false);
    }
  }

  async function deleteLesson(mod: ModuleWithLessons, les: Lesson) {
    if (!editing?.id || !confirm(`Excluir a aula "${les.title}"?`)) return;
    const res = await fetch(`/api/courses/${editing.id}/modules/${mod.id}/lessons/${les.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ modules: ModuleWithLessons[] }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Erro" : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Aula excluída.");
    if (json.data?.modules) setModules(json.data.modules);
    setLessonModal(null);
  }

  async function load() {
    setLoading(true);
    try {
      const coursesRes = await fetch("/api/courses");
      const coursesJson = (await coursesRes.json()) as ApiResponse<{ courses: Course[] }>;
      if (!coursesRes.ok || !coursesJson.ok) {
        toast.push("error", !coursesJson.ok ? coursesJson.error.message : "Falha ao carregar cursos.");
        return;
      }
      setItems(coursesJson.data.courses);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function inactivateCourse(c: Course) {
    if (!confirm(`Inativar o curso "${c.name}"?`)) return;
    const res = await fetch(`/api/courses/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "INACTIVE" }),
    });
    const json = (await res.json()) as ApiResponse<{ course: Course }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error?.message ?? "Erro" : "Falha ao inativar.");
      return;
    }
    toast.push("success", "Curso inativado.");
    await load();
  }

  async function reactivateCourse(c: Course) {
    const res = await fetch(`/api/courses/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    const json = (await res.json()) as ApiResponse<{ course: Course }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error?.message ?? "Erro" : "Falha ao reativar.");
      return;
    }
    toast.push("success", "Curso reativado.");
    await load();
  }

  async function deleteCourse(c: Course) {
    const msg = "Tem certeza que deseja excluir definitivamente este curso?";
    if (!confirm(msg)) return;
    const res = await fetch(`/api/courses/${c.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted?: boolean; inactivated?: boolean; message?: string }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error?.message ?? "Erro" : "Falha ao excluir.");
      return;
    }
    if (json.data?.inactivated) {
      toast.push("success", json.data.message ?? "Curso possui turmas; foi inativado.");
    } else {
      toast.push("success", "Curso excluído.");
    }
    await load();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || savingCourse) return;
    setSavingCourse(true);
    try {
    const payload: {
      name: string;
      description: string;
      content: string;
      imageUrl: string;
      status: Course["status"];
      workloadHours?: number;
    } = {
      name,
      description,
      content,
      imageUrl,
      status,
    };
    if (workloadHours.trim() !== "") {
      payload.workloadHours = Number(workloadHours);
    }

    const url = editing ? `/api/courses/${editing.id}` : "/api/courses";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as ApiResponse<{ course: Course }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao salvar curso.");
      return;
    }
    toast.push("success", editing ? "Curso atualizado." : "Curso criado.");
    setOpen(false);
    resetForm();
    await load();
    } finally {
      setSavingCourse(false);
    }
  }

  const visibleItems = showInactive ? items : items.filter((c) => c.status === "ACTIVE");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (open) formRef.current?.scrollTo?.({ top: 0 });
  }, [open]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-lg font-semibold">Cursos</div>
          <div className="text-sm text-[var(--text-secondary)]">
            Listagem em ordem alfabética. Por padrão, mostra apenas cursos ativos.
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowInactive((prev) => !prev)}
          >
            {showInactive ? "Ocultar inativos" : "Exibir inativos"}
          </Button>
          <Button onClick={openCreate} className="w-full sm:w-auto">Novo</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Foto</Th>
              <Th>Nome</Th>
              <Th>Status</Th>
              <Th>Carga horária</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((c) => (
              <tr key={c.id}>
                <Td>
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">—</span>
                  )}
                </Td>
                <Td>
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--text-primary)]">{c.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{c.description ?? ""}</span>
                  </div>
                </Td>
                <Td>
                  {c.status === "ACTIVE" ? (
                    <Badge tone="green">Ativo</Badge>
                  ) : (
                    <Badge tone="red">Inativo</Badge>
                  )}
                </Td>
                <Td>{c.workloadHours ?? "-"}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openEdit(c)}>
                      Editar
                    </Button>
                    {c.status === "ACTIVE" ? (
                      <Button
                        variant="secondary"
                        onClick={() => inactivateCourse(c)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Inativar
                      </Button>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={() => reactivateCourse(c)}>
                          Reativar
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => deleteCourse(c)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Excluir
                        </Button>
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {visibleItems.length === 0 ? (
              <tr>
                <Td />
                <Td>
                  <span className="text-[var(--text-secondary)]">
                    {showInactive
                      ? "Nenhum curso encontrado."
                      : "Nenhum curso ativo cadastrado."}
                  </span>
                </Td>
                <Td />
                <Td />
                <Td />
              </tr>
            ) : null}
          </tbody>
        </Table>
      )}

      <Modal
        open={open}
        title={editing ? "Editar curso" : "Novo curso"}
        onClose={() => { setOpen(false); resetForm(); }}
      >
        <form ref={formRef} className="flex max-h-[85vh] flex-col gap-3 overflow-y-auto" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Nome</label>
            <div className="mt-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Descrição (opcional)</label>
            <div className="mt-1">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Conteúdo (rich text, opcional)</label>
            <div className="mt-1">
              <RichTextEditor
                key={editing?.id ?? "new"}
                value={content}
                onChange={setContent}
                placeholder="Digite o conteúdo do curso..."
                minHeight="160px"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">URL da foto (opcional)</label>
            <div className="mt-1">
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              <CloudinaryImageUpload
                kind="formations"
                currentUrl={imageUrl || undefined}
                onUploaded={setImageUrl}
                label="Ou envie uma imagem"
              />
            </div>
            {imageUrl && (
              <img src={imageUrl} alt="Preview" className="mt-2 h-20 rounded object-cover" />
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Carga horária (opcional)</label>
            <div className="mt-1">
              <Input
                value={workloadHours}
                onChange={(e) => setWorkloadHours(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Status</label>
            <div className="mt-1">
              <select
                className="theme-input h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)]"
                value={status}
                onChange={(e) => setStatus(e.target.value as Course["status"])}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>
          </div>
          {editing && (
            <div className="border-t border-[var(--card-border)] pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Módulos e aulas</span>
                <Button type="button" variant="secondary" onClick={openModuleCreate}>
                  Novo módulo
                </Button>
              </div>
              {modulesLoading ? (
                <p className="mt-1 text-xs text-[var(--text-muted)]">Carregando...</p>
              ) : modules.length === 0 ? (
                <p className="mt-1 text-xs text-[var(--text-muted)]">Nenhum módulo. Clique em &quot;Novo módulo&quot; para adicionar.</p>
              ) : (
                <ul className="mt-2 max-h-64 overflow-y-auto text-sm">
                  {modules.map((mod) => (
                    <li key={mod.id} className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-[var(--text-primary)]">Módulo {mod.order + 1}: {mod.title}</span>
                        <div className="flex gap-1">
                          <Button type="button" variant="secondary" onClick={() => openModuleEdit(mod)}>
                            Editar
                          </Button>
                          <Button type="button" variant="secondary" className="text-red-600" onClick={() => deleteModule(mod)}>
                            Excluir
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => openLessonCreate(mod)}>
                            Nova aula
                          </Button>
                        </div>
                      </div>
                      {mod.description && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{mod.description}</p>}
                      <ul className="mt-2 pl-2">
                        {mod.lessons.map((les) => (
                          <li key={les.id} className="flex flex-wrap items-center justify-between gap-1 rounded py-0.5">
                            <span className="text-[var(--text-secondary)]">
                              Aula {les.order + 1}: {les.title}
                              {les.durationMinutes != null && (
                                <span className="text-[var(--text-muted)]"> ({les.durationMinutes} min)</span>
                              )}
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="text-xs text-blue-600 hover:underline"
                                onClick={() => openLessonEdit(mod, les)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="text-xs text-red-600 hover:underline"
                                onClick={() => deleteLesson(mod, les)}
                              >
                                Excluir
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || savingCourse}>
              {savingCourse ? "Salvando" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>

      {moduleModal && (
        <Modal
          open={!!moduleModal}
          title={moduleModal.type === "edit" ? "Editar módulo" : "Novo módulo"}
          onClose={() => setModuleModal(null)}
        >
          <form className="flex flex-col gap-3" onSubmit={saveModule}>
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input className="mt-1" value={moduleForm.title} onChange={(e) => setModuleForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <Input className="mt-1" value={moduleForm.description} onChange={(e) => setModuleForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Ordem</label>
              <Input type="number" min={0} className="mt-1" value={moduleForm.order} onChange={(e) => setModuleForm((f) => ({ ...f, order: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setModuleModal(null)} disabled={savingModule}>Cancelar</Button>
              <Button type="submit" disabled={savingModule}>{savingModule ? "Salvando" : "Salvar"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {lessonModal && (
        <Modal
          open={!!lessonModal}
          title={lessonModal.type === "edit" ? "Editar aula" : "Nova aula"}
          onClose={() => setLessonModal(null)}
          size="large"
        >
          <form className="flex max-h-[80vh] flex-col gap-3 overflow-y-auto" onSubmit={saveLesson}>
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input className="mt-1" value={lessonForm.title} onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Ordem</label>
              <Input type="number" min={0} className="mt-1" value={lessonForm.order} onChange={(e) => setLessonForm((f) => ({ ...f, order: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Duração (minutos, opcional)</label>
              <Input type="number" min={0} className="mt-1" value={lessonForm.durationMinutes} onChange={(e) => setLessonForm((f) => ({ ...f, durationMinutes: e.target.value }))} placeholder="Ex: 75" />
            </div>
            <div>
              <label className="text-sm font-medium">Vídeo (URL, opcional)</label>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">Cole o link do vídeo (YouTube, Vimeo, etc.).</p>
              <Input
                className="mt-1"
                type="url"
                value={lessonForm.videoUrl}
                onChange={(e) => setLessonForm((f) => ({ ...f, videoUrl: e.target.value }))}
                placeholder="Ex: https://www.youtube.com/watch?v=..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Imagens da aula</label>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">Anexe imagens para usar no conteúdo (copie o endereço e cole no rich text).</p>
              <div className="mt-1">
                <CloudinaryImageUpload
                  kind="formations"
                  currentUrl={undefined}
                  onUploaded={(url) => setLessonForm((f) => ({ ...f, imageUrls: [...(f.imageUrls ?? []), url] }))}
                  label="Adicionar imagem"
                />
              </div>
              {lessonForm.imageUrls && lessonForm.imageUrls.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {lessonForm.imageUrls.map((url, idx) => (
                    <li key={`${url}-${idx}`} className="flex items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-2">
                      <img src={url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-muted)]" title={url}>{url}</span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          toast.push("success", "Endereço copiado.");
                        }}
                      >
                        Copiar endereço
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="text-red-600"
                        onClick={() => setLessonForm((f) => ({ ...f, imageUrls: (f.imageUrls ?? []).filter((_, i) => i !== idx) }))}
                      >
                        Remover
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Conteúdo (rich text)</label>
              <RichTextEditor
                key={lessonModal.type === "edit" ? lessonModal.lesson?.id : "new"}
                value={lessonForm.contentRich}
                onChange={(v) => setLessonForm((f) => ({ ...f, contentRich: v }))}
                minHeight="180px"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setLessonModal(null)} disabled={savingLesson}>Cancelar</Button>
              <Button type="submit" disabled={savingLesson}>{savingLesson ? "Salvando" : "Salvar"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
