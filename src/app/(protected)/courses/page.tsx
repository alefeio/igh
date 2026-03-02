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

type Lesson = { id: string; title: string; order: number; durationMinutes: number | null; contentRich?: string | null };
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
  const [lessonForm, setLessonForm] = useState({ title: "", order: 0, durationMinutes: "" as string | number, contentRich: "" });

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
    if (!editing?.id || !moduleForm.title.trim()) return;
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
    setLessonForm({ title: "", order: mod.lessons.length, durationMinutes: "", contentRich: "" });
    setLessonModal({ type: "create", module: mod });
  }

  function openLessonEdit(mod: ModuleWithLessons, les: Lesson) {
    setLessonForm({
      title: les.title,
      order: les.order,
      durationMinutes: les.durationMinutes ?? "",
      contentRich: les.contentRich ?? "",
    });
    setLessonModal({ type: "edit", module: mod, lesson: les });
  }

  async function saveLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.id || !lessonModal || !lessonForm.title.trim()) return;
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
        contentRich: lessonForm.contentRich?.trim() || null,
      }),
    });
    const json = (await res.json()) as ApiResponse<{ modules: ModuleWithLessons[] }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Erro" : "Falha ao salvar aula.");
      return;
    }
    toast.push("success", isEdit ? "Aula atualizada." : "Aula criada.");
    if (json.data?.modules) setModules(json.data.modules);
    setLessonModal(null);
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
    if (!canSubmit) return;

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
          <div className="text-sm text-zinc-600">
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
        <div className="text-sm text-zinc-600">Carregando...</div>
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
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </Td>
                <Td>
                  <div className="flex flex-col">
                    <span className="font-medium text-zinc-900">{c.name}</span>
                    <span className="text-xs text-zinc-500">{c.description ?? ""}</span>
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
                  <span className="text-zinc-600">
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
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
                value={status}
                onChange={(e) => setStatus(e.target.value as Course["status"])}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>
          </div>
          {editing && (
            <div className="border-t border-zinc-200 pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-700">Módulos e aulas</span>
                <Button type="button" variant="secondary" onClick={openModuleCreate}>
                  Novo módulo
                </Button>
              </div>
              {modulesLoading ? (
                <p className="mt-1 text-xs text-zinc-500">Carregando...</p>
              ) : modules.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-500">Nenhum módulo. Clique em &quot;Novo módulo&quot; para adicionar.</p>
              ) : (
                <ul className="mt-2 max-h-64 space-y-3 overflow-y-auto text-sm">
                  {modules.map((mod) => (
                    <li key={mod.id} className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-zinc-800">Módulo {mod.order + 1}: {mod.title}</span>
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
                      {mod.description && <p className="mt-0.5 text-xs text-zinc-500">{mod.description}</p>}
                      <ul className="mt-2 space-y-1 pl-2">
                        {mod.lessons.map((les) => (
                          <li key={les.id} className="flex flex-wrap items-center justify-between gap-1 rounded py-0.5">
                            <span className="text-zinc-700">
                              Aula {les.order + 1}: {les.title}
                              {les.durationMinutes != null && (
                                <span className="text-zinc-400"> ({les.durationMinutes} min)</span>
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
            <Button type="submit" disabled={!canSubmit}>
              Salvar
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
              <Button type="button" variant="secondary" onClick={() => setModuleModal(null)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </Modal>
      )}

      {lessonModal && (
        <Modal
          open={!!lessonModal}
          title={lessonModal.type === "edit" ? "Editar aula" : "Nova aula"}
          onClose={() => setLessonModal(null)}
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
              <Button type="button" variant="secondary" onClick={() => setLessonModal(null)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
