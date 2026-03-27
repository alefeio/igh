"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { CloudinaryImageUpload } from "@/components/admin/CloudinaryImageUpload";
import { DashboardTutorial, type TutorialStep } from "@/components/dashboard/DashboardTutorial";
import { useUser } from "@/components/layout/UserProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import type { ApiResponse } from "@/lib/api-types";

type Course = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  content: string | null;
  imageUrl: string | null;
  workloadHours: number | null;
  status: "ACTIVE" | "INACTIVE" | "NOT_LISTED";
  createdAt: string;
};

type Lesson = { id: string; title: string; order: number; durationMinutes: number | null; videoUrl?: string | null; imageUrls?: string[]; contentRich?: string | null; summary?: string | null; pdfUrl?: string | null; attachmentUrls?: string[]; lastEditedAt?: string | null; lastEditedByUserName?: string | null };
type ModuleWithLessons = { id: string; title: string; description: string | null; order: number; lessons: Lesson[] };

export default function CourseEditPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const toast = useToast();
  const user = useUser();
  const isTeacher = user.role === "TEACHER";

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [workloadHours, setWorkloadHours] = useState<string>("");
  const [status, setStatus] = useState<Course["status"]>("ACTIVE");
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [moduleModal, setModuleModal] = useState<{ type: "create" | "edit"; module?: ModuleWithLessons } | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: "", description: "", order: 0 });
  const [savingCourse, setSavingCourse] = useState(false);
  const [savingModule, setSavingModule] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const canSubmit = useMemo(() => name.trim().length >= 2, [name]);

  const tutorialSteps: TutorialStep[] = useMemo(() => {
    if (!course) return [];
    return [
      { target: "[data-tour=\"course-edit-back\"]", title: "Voltar", content: "Use este botão para voltar à lista de cursos." },
      { target: "[data-tour=\"course-edit-dados\"]", title: "Dados do curso", content: "Aqui estão o nome, descrição, imagem, carga horária e status do curso. Como professor você só visualiza; coordenadores podem editar e salvar." },
      { target: "[data-tour=\"course-edit-conteudo\"]", title: "Conteúdo do curso", content: "Texto de apresentação do curso em formato rico. Como professor: somente leitura." },
      { target: "[data-tour=\"course-edit-modulos\"]", title: "Módulos e aulas", content: "Aqui ficam os módulos e as aulas do curso. Clique em \"Editar\" em uma aula para adicionar ou alterar vídeo, texto, anexos e resumo." },
    ];
  }, [course]);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/courses/${courseId}`).then((r) => r.json() as Promise<ApiResponse<{ course: Course }>>),
      fetch(`/api/courses/${courseId}/modules`).then(async (r) => {
        const text = await r.text();
        if (!text.trim()) return { ok: false as const, data: { modules: [] as ModuleWithLessons[] } };
        try {
          return JSON.parse(text) as ApiResponse<{ modules: ModuleWithLessons[] }>;
        } catch {
          return { ok: false as const, data: { modules: [] as ModuleWithLessons[] } };
        }
      }),
    ])
      .then(([courseRes, modulesRes]) => {
        if (courseRes.ok && courseRes.data?.course) {
          const c = courseRes.data.course;
          setCourse(c);
          setName(c.name);
          setDescription(c.description ?? "");
          setContent(c.content ?? "");
          setImageUrl(c.imageUrl ?? "");
          setWorkloadHours(c.workloadHours?.toString() ?? "");
          setStatus(c.status);
        } else {
          toast.push("error", "Curso não encontrado.");
          router.replace("/courses");
        }
        if (modulesRes.ok && modulesRes.data?.modules) setModules(modulesRes.data.modules);
      })
      .catch(() => {
        toast.push("error", "Falha ao carregar.");
        router.replace("/courses");
      })
      .finally(() => setLoading(false));
  }, [courseId, router, toast]);

  async function refetchModules() {
    setModulesLoading(true);
    try {
      const r = await fetch(`/api/courses/${courseId}/modules`);
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
    if (!moduleForm.title.trim() || savingModule) return;
    setSavingModule(true);
    try {
      const isEdit = moduleModal?.type === "edit" && moduleModal?.module;
      const url = isEdit ? `/api/courses/${courseId}/modules/${moduleModal!.module!.id}` : `/api/courses/${courseId}/modules`;
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
    if (!confirm(`Excluir o módulo "${mod.title}" e todas as suas aulas?`)) return;
    const res = await fetch(`/api/courses/${courseId}/modules/${mod.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ modules: ModuleWithLessons[] }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Erro" : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Módulo excluído.");
    if (json.data?.modules) setModules(json.data.modules);
    setModuleModal(null);
  }

  async function deleteLesson(mod: ModuleWithLessons, les: Lesson) {
    if (!confirm(`Excluir a aula "${les.title}"?`)) return;
    const res = await fetch(`/api/courses/${courseId}/modules/${mod.id}/lessons/${les.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ modules: ModuleWithLessons[] }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Erro" : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Aula excluída.");
    if (json.data?.modules) setModules(json.data.modules);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (isTeacher || !canSubmit || savingCourse) return;
    setSavingCourse(true);
    try {
      const payload: { name: string; description: string; content: string; imageUrl: string; status: Course["status"]; workloadHours?: number } = {
        name,
        description,
        content,
        imageUrl,
        status,
      };
      if (workloadHours.trim() !== "") payload.workloadHours = Number(workloadHours);

      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResponse<{ course: Course }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message ?? "Erro" : "Falha ao salvar curso.");
        return;
      }
      toast.push("success", "Curso atualizado.");
      if (json.data?.course) setCourse(json.data.course);
    } finally {
      setSavingCourse(false);
    }
  }

  useEffect(() => {
    if (loading) return;
    formRef.current?.scrollTo?.({ top: 0 });
  }, [loading]);

  if (loading || !course) {
    return (
      <div className="min-w-0">
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-12 text-center text-[var(--text-muted)]">
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardTutorial showForStudent={isTeacher && user.role !== "MASTER"} steps={tutorialSteps} storageKey="teacher-course-edit-tutorial-done" />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" className="-ml-1 text-[var(--text-muted)]" onClick={() => router.push("/courses")} data-tour="course-edit-back">
            ← Voltar aos cursos
          </Button>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            {isTeacher ? "Curso" : "Editar curso"}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">{course.name}{isTeacher && " — Você pode editar apenas o conteúdo das aulas."}</p>
        </div>
      </header>

      <form ref={formRef} className="flex flex-col gap-6" onSubmit={save}>
        <div className="card" data-tour="course-edit-dados">
          <div className="card-header">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Dados do curso</h2>
            {isTeacher && <p className="mt-0.5 text-xs text-[var(--text-muted)]">Somente visualização</p>}
          </div>
          <div className="card-body flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Nome</label>
              <div className="mt-1">
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isTeacher} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Descrição (opcional)</label>
              <div className="mt-1">
                <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={isTeacher} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">URL da foto (opcional)</label>
              <div className="mt-1">
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." disabled={isTeacher} />
                {!isTeacher && <CloudinaryImageUpload kind="formations" currentUrl={imageUrl || undefined} onUploaded={setImageUrl} label="Ou envie uma imagem" />}
              </div>
              {imageUrl && <img src={imageUrl} alt="Preview" className="mt-2 h-20 rounded object-cover" />}
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Carga horária (opcional)</label>
              <div className="mt-1">
                <Input value={workloadHours} onChange={(e) => setWorkloadHours(e.target.value)} inputMode="numeric" disabled={isTeacher} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Status</label>
              <div className="mt-1">
                <select
                  className="theme-input h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)] focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Course["status"])}
                  disabled={isTeacher}
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                  <option value="NOT_LISTED">Não listado</option>
                </select>
              </div>
            </div>
            {!isTeacher && (
              <div className="flex justify-end gap-2 border-t border-[var(--card-border)] pt-3">
                <Button type="submit" disabled={!canSubmit || savingCourse}>
                  {savingCourse ? "Salvando…" : "Salvar curso"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Painel Conteúdo (rich text): flutuante para admin; somente leitura para professor */}
        <div className="card sticky top-4 z-10 self-start shadow-md transition-shadow" data-tour="course-edit-conteudo">
          <div className="card-header">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Conteúdo (rich text, opcional)</h2>
            {isTeacher && <p className="mt-0.5 text-xs text-[var(--text-muted)]">Somente visualização</p>}
          </div>
          <div className="card-body">
            {isTeacher ? (
              <div className="prose prose-sm dark:prose-invert max-w-none min-h-[120px] rounded-md border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2" dangerouslySetInnerHTML={{ __html: content || "<p class=\"text-[var(--text-muted)]\">Nenhum conteúdo.</p>" }} />
            ) : (
              <RichTextEditor
                key={course.id}
                value={content}
                onChange={setContent}
                placeholder="Digite o conteúdo do curso..."
                minHeight="160px"
              />
            )}
          </div>
        </div>

        <div className="card" data-tour="course-edit-modulos">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--card-border)] px-4 py-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Módulos e aulas</h2>
            {!isTeacher && (
              <Button type="button" variant="secondary" size="sm" onClick={openModuleCreate}>
                Novo módulo
              </Button>
            )}
          </div>
          <div className="card-body">
            {modulesLoading ? (
              <div className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                Carregando módulos...
              </div>
            ) : modules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-4 text-center">
                <p className="text-sm text-[var(--text-muted)]">Nenhum módulo ainda.</p>
                {!isTeacher && (
                  <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={openModuleCreate}>
                    Adicionar primeiro módulo
                  </Button>
                )}
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {modules.map((mod) => (
                  <li key={mod.id} className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-[var(--text-primary)]">Módulo {mod.order + 1}: {mod.title}</span>
                      <div className="flex flex-wrap gap-1">
                        {!isTeacher && (
                          <Button type="button" variant="secondary" size="sm" onClick={() => openModuleEdit(mod)}>
                            Editar
                          </Button>
                        )}
                        {!isTeacher && (
                          <>
                            <Button type="button" variant="secondary" size="sm" className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" onClick={() => deleteModule(mod)}>
                              Excluir
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/courses/${courseId}/lesson/new?moduleId=${mod.id}`)}>
                              Nova aula
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {mod.description && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{mod.description}</p>}
                    <ul className="mt-2 pl-2">
                      {mod.lessons.map((les) => (
                        <li key={les.id} className="flex flex-wrap items-center justify-between gap-1 rounded py-1">
                          <div className="min-w-0 flex-1">
                            <span className="text-[var(--text-secondary)]">
                              Aula {les.order + 1}: {les.title}
                              {les.durationMinutes != null && <span className="text-[var(--text-muted)]"> ({les.durationMinutes} min)</span>}
                            </span>
                            {les.lastEditedByUserName && (
                              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                Última edição: {les.lastEditedByUserName}
                                {les.lastEditedAt && <> em {new Date(les.lastEditedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</>}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/courses/${courseId}/lesson/${les.id}`)}>
                              Editar
                            </Button>
                            {!isTeacher && (
                              <Button type="button" variant="secondary" size="sm" className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" onClick={() => deleteLesson(mod, les)}>
                                Excluir
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </form>

      {moduleModal && (
        <Modal open={!!moduleModal} title={moduleModal.type === "edit" ? "Editar módulo" : "Novo módulo"} onClose={() => setModuleModal(null)}>
          <form className="flex flex-col gap-4" onSubmit={saveModule}>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Título</label>
              <Input className="mt-1" value={moduleForm.title} onChange={(e) => setModuleForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex.: Módulo 1 - Introdução" />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Descrição (opcional)</label>
              <Input className="mt-1" value={moduleForm.description} onChange={(e) => setModuleForm((f) => ({ ...f, description: e.target.value }))} placeholder="Breve descrição do módulo" />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Ordem</label>
              <Input type="number" min={0} className="mt-1" value={moduleForm.order} onChange={(e) => setModuleForm((f) => ({ ...f, order: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--card-border)] pt-3">
              <Button type="button" variant="secondary" onClick={() => setModuleModal(null)} disabled={savingModule}>Cancelar</Button>
              <Button type="submit" disabled={savingModule}>{savingModule ? "Salvando…" : "Salvar"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
