"use client";

import { ArrowUp } from "lucide-react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CloudinaryFormationUpload } from "@/components/admin/CloudinaryFormationUpload";
import { DashboardTutorial, type TutorialStep } from "@/components/dashboard/DashboardTutorial";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import type { ApiResponse } from "@/lib/api-types";

type Lesson = { id: string; title: string; order: number; durationMinutes: number | null; videoUrl?: string | null; imageUrls?: string[]; contentRich?: string | null; summary?: string | null; pdfUrl?: string | null; attachmentUrls?: string[]; attachmentNames?: string[]; lastEditedAt?: string | null; lastEditedByUserName?: string | null };
type ModuleWithLessons = { id: string; title: string; description: string | null; order: number; lessons: Lesson[] };

type LessonExerciseOption = { id: string; text: string; isCorrect: boolean; order: number };
type LessonExercise = { id: string; lessonId: string; order: number; question: string; options: LessonExerciseOption[] };

const emptyLessonForm = {
  title: "",
  order: 0,
  durationMinutes: "" as string | number,
  videoUrl: "",
  imageUrls: [] as string[],
  contentRich: "",
  summary: "",
  attachmentUrls: [] as string[],
  attachmentNames: [] as string[],
  attachmentUrlInput: "",
  attachmentNameInput: "",
};

export default function LessonEditPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params.id as string;
  const lessonIdParam = params.lessonId as string;
  const isNew = lessonIdParam === "new";
  const moduleIdFromQuery = searchParams.get("moduleId");

  const toast = useToast();
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [moduleId, setModuleId] = useState<string | null>(isNew ? moduleIdFromQuery : null);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [lessonForm, setLessonForm] = useState(emptyLessonForm);
  const [savingLesson, setSavingLesson] = useState(false);
  const [lessonExercises, setLessonExercises] = useState<LessonExercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [exerciseModal, setExerciseModal] = useState<{ type: "add" | "edit"; exercise?: LessonExercise } | null>(null);
  const [exerciseForm, setExerciseForm] = useState({ question: "", options: [] as { text: string; isCorrect: boolean }[] });
  const [savingExercise, setSavingExercise] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const contentSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const currentModule = useMemo(() => modules.find((m) => m.id === moduleId), [modules, moduleId]);

  const tutorialSteps: TutorialStep[] = useMemo(() => {
    if (!moduleId) return [];
    const steps: TutorialStep[] = [
      { target: "[data-tour=\"lesson-edit-back\"]", title: "Voltar", content: "Use este botão para voltar à edição do curso (módulos e aulas)." },
      { target: "[data-tour=\"lesson-edit-dados\"]", title: "Dados da aula", content: "Preencha o título, ordem, duração e o link do vídeo. Você pode anexar imagens/arquivos e adicionar links de apoio com nome para exibição. O resumo aparece no topo da aula para o aluno." },
      { target: "[data-tour=\"lesson-edit-conteudo\"]", title: "Conteúdo (rich text)", content: "Escreva aqui o conteúdo principal da aula com formatação, listas e links. Esse texto é exibido ao aluno durante a aula. Para incluir uma imagem no conteúdo (rich text), basta copiar a imagem de Arquivos da aula e colar no conteúdo." },
    ];
    if (!isNew) {
      steps.push({ target: "[data-tour=\"lesson-edit-exercicios\"]", title: "Exercícios", content: "Adicione perguntas de múltipla escolha. Elas são exibidas ao final da aula para o aluno responder." });
    }
    steps.push({ target: "[data-tour=\"lesson-edit-actions\"]", title: "Salvar", content: "Use \"Salvar\" para gravar as alterações da aula ou \"Cancelar\" para voltar sem salvar." });
    return steps;
  }, [moduleId, isNew]);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    fetch(`/api/courses/${courseId}/modules`)
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
        if (json.ok && json.data?.modules) {
          setModules(json.data.modules);
          if (isNew) {
            if (!moduleIdFromQuery) {
              toast.push("error", "Informe o módulo (moduleId).");
              router.replace(`/courses/${courseId}/edit`);
              return;
            }
            const mod = json.data.modules.find((m) => m.id === moduleIdFromQuery);
            if (!mod) {
              toast.push("error", "Módulo não encontrado.");
              router.replace(`/courses/${courseId}/edit`);
              return;
            }
            setModuleId(moduleIdFromQuery);
            setLessonForm({ ...emptyLessonForm, order: mod.lessons.length });
          } else {
            let found: { mod: ModuleWithLessons; les: Lesson } | null = null;
            for (const mod of json.data.modules) {
              const les = mod.lessons.find((l) => l.id === lessonIdParam);
              if (les) {
                found = { mod, les };
                break;
              }
            }
            if (!found) {
              toast.push("error", "Aula não encontrada.");
              router.replace(`/courses/${courseId}/edit`);
              return;
            }
            setModuleId(found.mod.id);
            const les = found.les;
            const urls = les.attachmentUrls ?? [];
            const names = les.attachmentNames ?? [];
            const attachmentNamesPadded = [...names];
            while (attachmentNamesPadded.length < urls.length) attachmentNamesPadded.push("");
            setLessonForm({
              title: les.title,
              order: les.order,
              durationMinutes: les.durationMinutes ?? "",
              videoUrl: les.videoUrl ?? "",
              imageUrls: les.imageUrls ?? [],
              contentRich: les.contentRich ?? "",
              summary: les.summary ?? "",
              attachmentUrls: urls,
              attachmentNames: attachmentNamesPadded,
              attachmentUrlInput: "",
              attachmentNameInput: "",
            });
          }
        }
      })
      .catch(() => {
        toast.push("error", "Falha ao carregar.");
        router.replace(`/courses/${courseId}/edit`);
      })
      .finally(() => setLoading(false));
  }, [courseId, lessonIdParam, isNew, moduleIdFromQuery, router, toast]);

  useEffect(() => {
    if (!isNew && moduleId && lessonIdParam) {
      setLoadingExercises(true);
      fetch(`/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonIdParam}/exercises`)
        .then((r) => r.json() as Promise<ApiResponse<LessonExercise[]>>)
        .then((json) => {
          if (json.ok && json.data) setLessonExercises(json.data);
          else setLessonExercises([]);
        })
        .catch(() => setLessonExercises([]))
        .finally(() => setLoadingExercises(false));
    }
  }, [courseId, moduleId, lessonIdParam, isNew]);

  const openExerciseAdd = useCallback(() => {
    setExerciseForm({ question: "", options: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] });
    setExerciseModal({ type: "add" });
  }, []);

  const openExerciseEdit = useCallback((ex: LessonExercise) => {
    setExerciseForm({
      question: ex.question,
      options: ex.options.length >= 2 ? ex.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) : [{ text: "", isCorrect: true }, { text: "", isCorrect: false }],
    });
    setExerciseModal({ type: "edit", exercise: ex });
  }, []);

  async function saveExercise(e: React.FormEvent) {
    e.preventDefault();
    if (!moduleId || !lessonIdParam || lessonIdParam === "new" || savingExercise) return;
    const question = exerciseForm.question.trim();
    const options = exerciseForm.options.filter((o) => o.text.trim());
    if (!question) {
      toast.push("error", "Digite a pergunta.");
      return;
    }
    if (options.length < 2) {
      toast.push("error", "Adicione pelo menos 2 opções.");
      return;
    }
    if (!options.some((o) => o.isCorrect)) {
      toast.push("error", "Marque uma opção como correta.");
      return;
    }
    setSavingExercise(true);
    try {
      const base = `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonIdParam}/exercises`;
      const isEdit = exerciseModal?.type === "edit" && exerciseModal?.exercise;
      const url = isEdit ? `${base}/${exerciseModal.exercise!.id}` : base;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          order: isEdit ? exerciseModal.exercise!.order : lessonExercises.length,
          options: options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
        }),
      });
      const json = await res.json() as ApiResponse<LessonExercise>;
      if (!res.ok || !json.ok) {
        toast.push("error", (json as { error?: { message?: string } }).error?.message ?? "Erro ao salvar exercício.");
        return;
      }
      toast.push("success", isEdit ? "Exercício atualizado." : "Exercício adicionado.");
      if (isEdit) setLessonExercises((prev) => prev.map((ex) => (ex.id === json.data!.id ? json.data! : ex)));
      else setLessonExercises((prev) => [...prev, json.data!]);
      setExerciseModal(null);
    } finally {
      setSavingExercise(false);
    }
  }

  async function deleteExercise(ex: LessonExercise) {
    if (!moduleId || lessonIdParam === "new" || !confirm("Excluir este exercício?")) return;
    const res = await fetch(
      `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonIdParam}/exercises/${ex.id}`,
      { method: "DELETE" }
    );
    const json = await res.json() as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", (json as { error?: { message?: string } }).error?.message ?? "Erro ao excluir.");
      return;
    }
    toast.push("success", "Exercício excluído.");
    setLessonExercises((prev) => prev.filter((e) => e.id !== ex.id));
  }

  async function saveLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!moduleId || !lessonForm.title.trim() || savingLesson) return;
    setSavingLesson(true);
    try {
      const duration = lessonForm.durationMinutes === "" ? null : Number(lessonForm.durationMinutes);
      const url = isNew
        ? `/api/courses/${courseId}/modules/${moduleId}/lessons`
        : `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonIdParam}`;
      const method = isNew ? "POST" : "PATCH";
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
          summary: lessonForm.summary?.trim() || null,
          pdfUrl: null,
          attachmentUrls: lessonForm.attachmentUrls ?? [],
          attachmentNames: (lessonForm.attachmentNames ?? []).slice(0, (lessonForm.attachmentUrls ?? []).length).map((s) => String(s).trim()),
        }),
      });
      const text = await res.text();
      let json: ApiResponse<{ modules?: ModuleWithLessons[]; lesson?: Lesson }>;
      try {
        json = (text ? JSON.parse(text) : { ok: false }) as ApiResponse<{ modules?: ModuleWithLessons[]; lesson?: Lesson }>;
      } catch {
        if (!res.ok) {
          toast.push("error", res.status === 404 ? "Aula não encontrada." : `Erro ao salvar (${res.status}).`);
          return;
        }
        json = { ok: false } as ApiResponse<{ modules?: ModuleWithLessons[]; lesson?: Lesson }>;
      }
      if (!res.ok || !json.ok) {
        const errMsg = json && !(json as { ok?: boolean }).ok && "error" in json ? (json as { error?: { message?: string } }).error?.message : null;
        toast.push("error", errMsg ?? "Falha ao salvar aula.");
        return;
      }
      toast.push("success", isNew ? "Aula criada." : "Aula atualizada.");
      if (isNew && (json as { data?: { lesson?: Lesson } }).data?.lesson) {
        router.replace(`/courses/${courseId}/lesson/${(json as { data: { lesson: Lesson } }).data.lesson.id}`);
        return;
      }
      if (!isNew) {
        const mods = (json as { data?: { modules?: ModuleWithLessons[] } }).data?.modules;
        if (mods) setModules(mods);
      }
    } finally {
      setSavingLesson(false);
    }
  }

  if (loading || (isNew && !moduleIdFromQuery) || (!isNew && !moduleId)) {
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
      <DashboardTutorial showForStudent={user.role !== "MASTER"} steps={tutorialSteps} storageKey="teacher-lesson-edit-tutorial-done" />
      <header className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="-ml-1 w-fit text-[var(--text-muted)]" onClick={() => router.push(`/courses/${courseId}/edit`)} data-tour="lesson-edit-back">
          ← Voltar ao curso
        </Button>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          {isNew ? "Nova aula" : "Editar aula"}
        </h1>
        {currentModule && (
          <p className="text-sm text-[var(--text-muted)]">
            Módulo {currentModule.order + 1}: {currentModule.title}
          </p>
        )}
      </header>

      <form className="flex flex-col gap-6" onSubmit={saveLesson}>
        {/* Parte superior: campos que podem ficar ocultos no scroll */}
        <div className="card" data-tour="lesson-edit-dados">
          <div className="card-header">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Dados da aula</h2>
          </div>
          <div className="card-body flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Título</label>
              <Input className="mt-1" value={lessonForm.title} onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex.: Aula 1 - Conceitos iniciais" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)]">Ordem</label>
                <Input type="number" min={0} className="mt-1" value={lessonForm.order} onChange={(e) => setLessonForm((f) => ({ ...f, order: parseInt(e.target.value, 10) || 0 }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)]">Duração (min)</label>
                <Input type="number" min={0} className="mt-1" value={lessonForm.durationMinutes} onChange={(e) => setLessonForm((f) => ({ ...f, durationMinutes: e.target.value }))} placeholder="Ex: 75" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Vídeo (URL, opcional)</label>
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
              <label className="text-sm font-medium text-[var(--text-primary)]">Arquivos da aula</label>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">Anexe imagens e arquivos. Para inserir uma imagem no Conteúdo (rich text), copie o arquivo aqui (botão &quot;Copiar arquivo&quot;) e cole (Ctrl+V) no editor abaixo.</p>
              <div className="mt-1">
                <CloudinaryFormationUpload
                  onUploaded={(url) => setLessonForm((f) => ({ ...f, imageUrls: [...(f.imageUrls ?? []), url] }))}
                  label="Adicionar arquivo"
                  multiple
                />
              </div>
              {lessonForm.imageUrls && lessonForm.imageUrls.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {lessonForm.imageUrls.map((url, idx) => {
                    const isImageUrl = url.includes("/image/upload/");
                    return (
                      <li key={`${url}-${idx}`} className="flex items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-2">
                        {isImageUrl ? (
                          <img src={url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                        ) : (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[var(--card-border)] text-[var(--text-muted)]" title="Abrir arquivo">📎</a>
                        )}
                        <Button type="button" variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.push("success", "Copiado. Cole no Conteúdo (rich text) com Ctrl+V."); }}>Copiar arquivo</Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.push("success", "Endereço copiado."); }}>Copiar endereço do arquivo</Button>
                        <Button type="button" variant="secondary" size="sm" className="text-red-600" onClick={() => setLessonForm((f) => ({ ...f, imageUrls: (f.imageUrls ?? []).filter((_, i) => i !== idx) }))}>Remover</Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Arquivos de apoio (URLs, opcional)</label>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">Informe a URL e um nome para exibição. O nome é o texto do link para o aluno.</p>
              <div className="mt-1 flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--text-muted)]">URL</span>
                  <Input
                    className="max-w-xs"
                    type="url"
                    placeholder="https://..."
                    value={lessonForm.attachmentUrlInput ?? ""}
                    onChange={(e) => setLessonForm((f) => ({ ...f, attachmentUrlInput: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const url = (lessonForm.attachmentUrlInput ?? "").trim();
                      const name = (lessonForm.attachmentNameInput ?? "").trim();
                      if (url) setLessonForm((f) => ({ ...f, attachmentUrls: [...(f.attachmentUrls ?? []), url], attachmentNames: [...(f.attachmentNames ?? []), name], attachmentUrlInput: "", attachmentNameInput: "" }));
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--text-muted)]">Nome</span>
                  <Input
                    className="max-w-xs"
                    placeholder="Ex.: Material complementar PDF"
                    value={lessonForm.attachmentNameInput ?? ""}
                    onChange={(e) => setLessonForm((f) => ({ ...f, attachmentNameInput: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const url = (lessonForm.attachmentUrlInput ?? "").trim();
                      const name = (lessonForm.attachmentNameInput ?? "").trim();
                      if (url) setLessonForm((f) => ({ ...f, attachmentUrls: [...(f.attachmentUrls ?? []), url], attachmentNames: [...(f.attachmentNames ?? []), name], attachmentUrlInput: "", attachmentNameInput: "" }));
                    }}
                  />
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => { const url = (lessonForm.attachmentUrlInput ?? "").trim(); const name = (lessonForm.attachmentNameInput ?? "").trim(); if (url) setLessonForm((f) => ({ ...f, attachmentUrls: [...(f.attachmentUrls ?? []), url], attachmentNames: [...(f.attachmentNames ?? []), name], attachmentUrlInput: "", attachmentNameInput: "" })); }}>Adicionar</Button>
              </div>
              {lessonForm.attachmentUrls && lessonForm.attachmentUrls.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {lessonForm.attachmentUrls.map((url, idx) => (
                    <li key={`${url}-${idx}`} className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-2">
                      <div className="min-w-0 flex-1">
                        <Input
                          className="mb-1 max-w-sm text-xs"
                          placeholder="Nome do arquivo"
                          value={(lessonForm.attachmentNames ?? [])[idx] ?? ""}
                          onChange={(e) => setLessonForm((f) => ({ ...f, attachmentNames: (f.attachmentNames ?? []).map((n, i) => (i === idx ? e.target.value : n)) }))}
                        />
                        <span className="block truncate text-xs text-[var(--text-muted)]" title={url}>{url}</span>
                      </div>
                      <Button type="button" variant="secondary" size="sm" className="text-red-600 shrink-0" onClick={() => setLessonForm((f) => ({ ...f, attachmentUrls: (f.attachmentUrls ?? []).filter((_, i) => i !== idx), attachmentNames: (f.attachmentNames ?? []).filter((_, i) => i !== idx) }))}>Remover</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Resumo rápido da aula</label>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">Texto exibido no topo da aula para o aluno.</p>
              <textarea
                className="mt-1 w-full min-h-[80px] rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm"
                value={lessonForm.summary}
                onChange={(e) => setLessonForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder={"Ex.: Nesta aula você verá:\n• Conceitos de...\n• Prática de...\n• Exercícios..."}
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* Painel de Conteúdo (rich text) flutuante: sticky ao fazer scroll */}
        <div ref={contentSectionRef} className="card sticky top-4 z-10 self-start shadow-md transition-shadow" data-tour="lesson-edit-conteudo">
          <div className="card-header">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Conteúdo (rich text)</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">Para inserir uma imagem no conteúdo: copie em &quot;Arquivos da aula&quot; (botão Copiar arquivo) e cole (Ctrl+V) aqui.</p>
          </div>
          <div className="card-body">
            <RichTextEditor
              key={isNew ? "new" : lessonIdParam}
              value={lessonForm.contentRich}
              onChange={(v) => setLessonForm((f) => ({ ...f, contentRich: v }))}
              minHeight="220px"
              className="mt-1"
            />
          </div>
        </div>

        {/* Exercícios (só em edição) */}
        {!isNew && moduleId && lessonIdParam && (
          <div className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-4" data-tour="lesson-edit-exercicios">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--text-primary)]">Exercícios de múltipla escolha</label>
              <Button type="button" variant="secondary" size="sm" onClick={openExerciseAdd}>Adicionar exercício</Button>
            </div>
            <p className="mb-2 text-xs text-[var(--text-muted)]">Exibidos ao final da aula para o aluno responder.</p>
            {loadingExercises ? (
              <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
            ) : lessonExercises.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Nenhum exercício. Clique em &quot;Adicionar exercício&quot; para criar.</p>
            ) : (
              <ul className="list-none space-y-3 pl-0">
                {lessonExercises.map((ex, idx) => (
                  <li key={ex.id} className="rounded border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                    <p className="mb-2 font-medium text-[var(--text-primary)]">{idx + 1}. {ex.question}</p>
                    <ul className="mb-2 list-none pl-0 text-sm text-[var(--text-secondary)]">
                      {ex.options.map((o) => (
                        <li key={o.id}>{o.text}{o.isCorrect ? " ✓" : ""}</li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => openExerciseEdit(ex)}>Editar</Button>
                      <Button type="button" variant="secondary" size="sm" className="text-red-600" onClick={() => deleteExercise(ex)}>Excluir</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--card-border)] pt-3" data-tour="lesson-edit-actions">
          <Button type="button" variant="secondary" onClick={() => router.push(`/courses/${courseId}/edit`)} disabled={savingLesson}>Cancelar</Button>
          <Button type="submit" disabled={savingLesson}>{savingLesson ? "Salvando…" : "Salvar"}</Button>
        </div>
      </form>

      {exerciseModal && (
        <Modal open={!!exerciseModal} title={exerciseModal.type === "edit" ? "Editar exercício" : "Novo exercício"} onClose={() => setExerciseModal(null)} size="large">
          <form onSubmit={saveExercise} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Pergunta</label>
              <textarea
                className="mt-1 w-full min-h-[60px] rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm"
                value={exerciseForm.question}
                onChange={(e) => setExerciseForm((f) => ({ ...f, question: e.target.value }))}
                placeholder="Ex.: Qual a principal vantagem de..."
                required
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Opções (marque a correta)</label>
              <div className="mt-2 space-y-2">
                {exerciseForm.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={opt.isCorrect}
                      onChange={() => setExerciseForm((f) => ({ ...f, options: f.options.map((o, i) => ({ ...o, isCorrect: i === idx })) }))}
                      className="shrink-0"
                    />
                    <Input
                      className="flex-1"
                      value={opt.text}
                      onChange={(e) => setExerciseForm((f) => ({ ...f, options: f.options.map((o, i) => (i === idx ? { ...o, text: e.target.value } : o)) }))}
                      placeholder={`Opção ${idx + 1}`}
                    />
                    {exerciseForm.options.length > 2 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="text-red-600 shrink-0"
                        onClick={() => {
                          setExerciseForm((f) => {
                            const next = f.options.filter((_, i) => i !== idx);
                            const hasCorrect = next.some((o) => o.isCorrect);
                            return { ...f, options: hasCorrect ? next : next.map((o, i) => (i === 0 ? { ...o, isCorrect: true } : o)) };
                          });
                        }}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="secondary" size="sm" onClick={() => setExerciseForm((f) => ({ ...f, options: [...f.options, { text: "", isCorrect: false }] }))}>+ Opção</Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--card-border)] pt-3">
              <Button type="button" variant="secondary" onClick={() => setExerciseModal(null)} disabled={savingExercise}>Cancelar</Button>
              <Button type="submit" disabled={savingExercise}>{savingExercise ? "Salvando…" : "Salvar"}</Button>
            </div>
          </form>
        </Modal>
      )}
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed right-4 bottom-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-secondary)] shadow-md hover:bg-[var(--card-bg)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          title="Voltar ao topo"
          aria-label="Voltar ao topo"
        >
          <ArrowUp className="h-5 w-5" aria-hidden />
        </button>
      )}
    </div>
  );
}
