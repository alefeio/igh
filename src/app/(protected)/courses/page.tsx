"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Td, Th } from "@/components/ui/Table";
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

export default function CoursesPage() {
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const isTeacher = user.role === "TEACHER";
  const canBackup =
    !isTeacher &&
    (user.role === "MASTER" || user.role === "GENERAL_ADMIN" || user.role === "ADMIN");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Course[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

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
  }, [toast]);

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  async function duplicateCourse(c: Course) {
    if (!confirm(`Duplicar o curso "${c.name}"? Será criada uma cópia com todos os módulos e aulas.`)) return;
    setDuplicatingId(c.id);
    try {
      const res = await fetch(`/api/courses/${c.id}/duplicate`, { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ course: Course }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message ?? "Erro" : "Falha ao duplicar.");
        return;
      }
      toast.push("success", "Curso duplicado com sucesso.");
      const newCourse = json.data!.course;
      await load();
      router.push(`/courses/${newCourse.id}/edit`);
    } finally {
      setDuplicatingId(null);
    }
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

  const visibleItems = useMemo(
    () => (showInactive ? items : items.filter((c) => c.status === "ACTIVE")),
    [items, showInactive],
  );

  const allVisibleSelected =
    visibleItems.length > 0 && visibleItems.every((c) => selectedIds.has(c.id));

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const c of visibleItems) next.delete(c.id);
      } else {
        for (const c of visibleItems) next.add(c.id);
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function exportSelected() {
    const courseIds = [...selectedIds];
    if (courseIds.length === 0) {
      toast.push("error", "Selecione ao menos um curso para exportar.");
      return;
    }
    setExporting(true);
    try {
      const res = await fetch("/api/courses/backup/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseIds }),
      });
      const json = (await res.json()) as ApiResponse<{ backup: { courses: unknown[] } }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao exportar.");
        return;
      }
      const backup = json.data.backup;
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cursos-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.push("success", `Backup de ${backup.courses.length} curso(s) baixado.`);
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Erro ao exportar.");
    } finally {
      setExporting(false);
    }
  }

  async function importBackupFile(file: File) {
    if (
      !confirm(
        "Importar backup de cursos? Cursos com o mesmo ID serão sobrescritos (módulos/aulas/exercícios). Turmas e matrículas não entram neste arquivo.",
      )
    ) {
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        toast.push("error", "Arquivo JSON inválido.");
        return;
      }
      const res = await fetch("/api/courses/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = (await res.json()) as ApiResponse<{
        message?: string;
        imported?: number;
        created?: number;
        updated?: number;
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao importar.");
        return;
      }
      toast.push("success", json.data.message ?? "Cursos importados.");
      setSelectedIds(new Set());
      await load();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Erro ao importar.");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function setCourseStatus(c: Course, newStatus: Course["status"]) {
    if (newStatus === "INACTIVE" && !confirm(`Inativar o curso "${c.name}"?`)) return;
    const res = await fetch(`/api/courses/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const json = (await res.json()) as ApiResponse<{ course: Course }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error?.message ?? "Erro" : "Falha ao alterar status.");
      return;
    }
    const msg =
      newStatus === "ACTIVE"
        ? "Curso ativo (listado no site)."
        : newStatus === "INACTIVE"
          ? "Curso inativado."
          : "Curso não será listado no site.";
    toast.push("success", msg);
    await load();
  }

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <DashboardHero
        eyebrow={isTeacher ? "Área do professor" : "Conteúdo"}
        title="Cursos"
        description={
          isTeacher
            ? "Cursos aos quais você tem acesso para edição."
            : "Cadastre cursos, módulos e aulas. Por padrão só aparecem ativos. «Não listado» não entra no site."
        }
        rightSlot={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowInactive((prev) => !prev)}
              className="w-full sm:w-auto"
            >
              {showInactive ? "Ocultar inativos e não listados" : "Exibir inativos e não listados"}
            </Button>
            {!isTeacher && (
              <Button onClick={() => router.push("/courses/new")} className="w-full sm:w-auto">
                Novo curso
              </Button>
            )}
          </div>
        }
      />

      {canBackup ? (
        <SectionCard
          title="Backup de cursos"
          description="Exporta ou importa só o conteúdo pedagógico (curso, módulos, aulas e exercícios). Não inclui turmas nem matrículas. Mídia permanece como URL."
          variant="elevated"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              variant="secondary"
              disabled={exporting || selectedIds.size === 0}
              onClick={() => void exportSelected()}
            >
              {exporting
                ? "Exportando…"
                : selectedIds.size === 0
                  ? "Exportar backup"
                  : `Exportar backup (${selectedIds.size})`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
            >
              {importing ? "Importando…" : "Importar backup"}
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importBackupFile(file);
              }}
            />
            <p className="text-xs text-[var(--text-muted)]">
              Marque os cursos na tabela abaixo para exportar. Ao importar, o mesmo ID sobrescreve o curso
              existente.
            </p>
          </div>
        </SectionCard>
      ) : null}

      {loading ? (
        <SectionCard title="Cursos" description="Carregando a lista…" variant="elevated">
          <div className="flex flex-col items-center justify-center py-14 text-[var(--text-muted)]" role="status" aria-live="polite">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--igh-primary)]/20" aria-hidden />
            <p className="mt-3 text-sm">Carregando cursos…</p>
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          title="Listagem de cursos"
          description={
            visibleItems.length === 0
              ? "Nenhum curso para exibir com os filtros atuais."
              : `${visibleItems.length} ${visibleItems.length === 1 ? "curso" : "cursos"}`
          }
          variant="elevated"
        >
          {visibleItems.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-6 py-12 text-center"
              role="status"
            >
              <p className="text-sm text-[var(--text-muted)]">
                {showInactive
                  ? "Nenhum curso encontrado."
                  : "Nenhum curso ativo cadastrado. Clique em «Novo curso» para começar."}
              </p>
              {!showInactive && !isTeacher && (
                <Button
                  type="button"
                  variant="primary"
                  className="mt-4"
                  onClick={() => router.push("/courses/new")}
                >
                  Novo curso
                </Button>
              )}
            </div>
          ) : (
            <TableShell>
              <thead>
                <tr>
                  {canBackup ? (
                    <Th>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[var(--input-border)]"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          aria-label="Selecionar todos os cursos visíveis"
                        />
                      </label>
                    </Th>
                  ) : null}
                  <Th>Foto</Th>
                  <Th>Nome</Th>
                  <Th>Status</Th>
                  <Th>Carga horária</Th>
                  <Th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((c) => (
                  <tr key={c.id}>
                    {canBackup ? (
                      <Td>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[var(--input-border)]"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          aria-label={`Selecionar ${c.name}`}
                        />
                      </Td>
                    ) : null}
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
                        {c.description && (
                          <span className="text-xs text-[var(--text-muted)] line-clamp-1">{c.description}</span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {c.status === "ACTIVE" ? (
                        <Badge tone="green">Ativo</Badge>
                      ) : c.status === "NOT_LISTED" ? (
                        <Badge tone="amber">Não listado</Badge>
                      ) : (
                        <Badge tone="zinc">Inativo</Badge>
                      )}
                    </Td>
                    <Td>{c.workloadHours ?? "—"}</Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => router.push(`/courses/${c.id}/edit`)}>
                          Editar
                        </Button>
                        {!isTeacher && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => duplicateCourse(c)}
                            disabled={duplicatingId === c.id}
                          >
                            {duplicatingId === c.id ? "Duplicando…" : "Duplicar"}
                          </Button>
                        )}
                        {!isTeacher && (
                          <>
                            {c.status === "ACTIVE" && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setCourseStatus(c, "INACTIVE")}
                                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  Inativar
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => setCourseStatus(c, "NOT_LISTED")}>
                                  Não listar no site
                                </Button>
                              </>
                            )}
                            {(c.status === "INACTIVE" || c.status === "NOT_LISTED") && (
                              <>
                                <Button variant="secondary" size="sm" onClick={() => setCourseStatus(c, "ACTIVE")}>
                                  {c.status === "NOT_LISTED" ? "Listar no site" : "Reativar"}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => deleteCourse(c)}
                                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  Excluir
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </SectionCard>
      )}
    </div>
  );
}
