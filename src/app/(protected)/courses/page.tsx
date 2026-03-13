"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useUser } from "@/components/layout/UserProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
  status: "ACTIVE" | "INACTIVE" | "NOT_LISTED";
  createdAt: string;
};

export default function CoursesPage() {
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const isTeacher = user.role === "TEACHER";
  const isMaster = user.role === "MASTER";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Course[]>([]);
  const [showInactive, setShowInactive] = useState(false);

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

  const visibleItems = showInactive ? items : items.filter((c) => c.status === "ACTIVE");

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
    const msg = newStatus === "ACTIVE" ? "Curso ativo (listado no site)." : newStatus === "INACTIVE" ? "Curso inativado." : "Curso não será listado no site.";
    toast.push("success", msg);
    await load();
  }

  return (
    <div className="container-page flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            Cursos
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Cadastre cursos, módulos e aulas. Por padrão são exibidos apenas os ativos. «Não listado» não aparece no site.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowInactive((prev) => !prev)}
            className="w-full sm:w-auto"
          >
            {showInactive ? "Ocultar inativos e não listados" : "Exibir inativos e não listados"}
          </Button>
          <Button onClick={() => router.push("/courses/new")} className="w-full sm:w-auto">
            Novo curso
          </Button>
        </div>
      </header>

      {loading ? (
        <div
          className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-12 text-center text-[var(--text-muted)]"
          role="status"
          aria-live="polite"
        >
          Carregando cursos...
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Listagem de cursos
            </h2>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {visibleItems.length === 0
                ? "Nenhum curso para exibir"
                : `${visibleItems.length} ${visibleItems.length === 1 ? "curso" : "cursos"}`}
            </p>
          </div>
          <div className="card-body overflow-x-auto p-0">
            {visibleItems.length === 0 ? (
              <div
                className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-10 text-center"
                role="status"
              >
                <p className="text-sm text-[var(--text-muted)]">
                  {showInactive
                    ? "Nenhum curso encontrado."
                    : "Nenhum curso ativo cadastrado. Clique em «Novo curso» para começar."}
                </p>
                {!showInactive && (
                  <Button
                    type="button"
                    variant="primary"
                    className="mt-3"
                    onClick={() => router.push("/courses/new")}
                  >
                    Novo curso
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
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
                          {isMaster && (
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
              </Table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
