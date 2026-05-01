"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";

type Lesson = {
  id: string;
  title: string;
  order: number;
  durationMinutes: number | null;
  summary: string | null;
  pdfUrl: string | null;
  attachmentUrls: string[];
  attachmentNames: string[];
};

type Module = { id: string; title: string; description: string | null; order: number; lessons: Lesson[] };
type Course = { id: string; name: string; status: string; workloadHours: number | null; modules: Module[] };

type ApiResponse<T> = { ok: boolean; data?: T; error?: { message?: string } };

function toLessonCount(c: Course): number {
  return c.modules.reduce((acc, m) => acc + (m.lessons?.length ?? 0), 0);
}

function flattenLessonIds(c: Course): string[] {
  return c.modules.flatMap((m) => m.lessons.map((l) => l.id));
}

export default function PlanosDeAulaPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(new Set());
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set());
  const [includeContentRich, setIncludeContentRich] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/courses/lesson-plans/options", { cache: "no-store" })
      .then((r) => r.json() as Promise<ApiResponse<{ courses: Course[] }>>)
      .then((json) => {
        if (!json.ok || !json.data?.courses) throw new Error(json.error?.message || "Falha ao carregar cursos.");
        setCourses(json.data.courses);
      })
      .catch((e) => toast.push("error", e?.message || "Falha ao carregar."))
      .finally(() => setLoading(false));
  }, [toast]);

  const allLessonIds = useMemo(() => courses.flatMap((c) => flattenLessonIds(c)), [courses]);

  const selectedLessonCount = selectedLessonIds.size;
  const canExport = selectedCourseIds.size > 0 && selectedLessonCount > 0 && !exporting;

  function toggleExpand(courseId: string) {
    setExpandedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  function setCourseSelected(course: Course, checked: boolean) {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(course.id);
      else next.delete(course.id);
      return next;
    });

    // Quando seleciona/desmarca curso, por padrão seleciona/desmarca todas as aulas dele
    const lessonIds = flattenLessonIds(course);
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      if (checked) lessonIds.forEach((id) => next.add(id));
      else lessonIds.forEach((id) => next.delete(id));
      return next;
    });
  }

  function setLessonSelected(course: Course, lessonId: string, checked: boolean) {
    const courseLessonIds = new Set(flattenLessonIds(course));
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(lessonId);
      else next.delete(lessonId);

      const hasAnyInCourse = Array.from(next).some((id) => courseLessonIds.has(id));
      setSelectedCourseIds((prevCourses) => {
        const nextCourses = new Set(prevCourses);
        if (hasAnyInCourse) nextCourses.add(course.id);
        else nextCourses.delete(course.id);
        return nextCourses;
      });

      return next;
    });
  }

  function selectAllCoursesAndLessons(checked: boolean) {
    if (checked) {
      setSelectedCourseIds(new Set(courses.map((c) => c.id)));
      setSelectedLessonIds(new Set(allLessonIds));
    } else {
      setSelectedCourseIds(new Set());
      setSelectedLessonIds(new Set());
    }
  }

  function selectAllLessonsOfCourse(course: Course, checked: boolean) {
    const ids = flattenLessonIds(course);
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      if (checked) ids.forEach((id) => next.add(id));
      else ids.forEach((id) => next.delete(id));
      return next;
    });
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(course.id);
      else next.delete(course.id);
      return next;
    });
  }

  async function exportZip() {
    if (!canExport) return;
    setExporting(true);
    try {
      const selections = courses
        .filter((c) => selectedCourseIds.has(c.id))
        .map((c) => {
          const ids = flattenLessonIds(c).filter((id) => selectedLessonIds.has(id));
          return { courseId: c.id, lessonIds: ids };
        })
        .filter((x) => x.lessonIds.length > 0);

      const res = await fetch("/api/admin/courses/lesson-plans/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeContentRich, selections }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Falha ao exportar.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "planos-de-aula.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.push("success", "Download iniciado.");
    } catch (e: any) {
      toast.push("error", e?.message || "Falha ao exportar.");
    } finally {
      setExporting(false);
    }
  }

  const allChecked = allLessonIds.length > 0 && selectedLessonIds.size === allLessonIds.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Planos de aula (PDF)</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">
            Selecione cursos e aulas para gerar um PDF por curso (com materiais listados por URL) e baixar tudo em um ZIP.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => selectAllCoursesAndLessons(true)} disabled={loading || exporting}>
            Selecionar tudo
          </Button>
          <Button variant="secondary" onClick={() => selectAllCoursesAndLessons(false)} disabled={loading || exporting}>
            Limpar seleção
          </Button>
          <Button onClick={() => void exportZip()} disabled={!canExport}>
            {exporting ? "Gerando…" : "Gerar e baixar (ZIP)"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allChecked}
              onCheckedChange={(v) => selectAllCoursesAndLessons(Boolean(v))}
              disabled={loading || exporting}
            />
            <div className="text-sm">
              <div className="font-medium text-[var(--text-primary)]">Seleção</div>
              <div className="text-[var(--text-muted)]">
                {selectedCourseIds.size} curso(s) e {selectedLessonCount} aula(s) selecionada(s)
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Incluir no PDF:</span>
            <Button
              variant={!includeContentRich ? "primary" : "secondary"}
              size="sm"
              onClick={() => setIncludeContentRich(false)}
              disabled={exporting}
            >
              Apenas resumo
            </Button>
            <Button
              variant={includeContentRich ? "primary" : "secondary"}
              size="sm"
              onClick={() => setIncludeContentRich(true)}
              disabled={exporting}
            >
              Resumo + conteúdo
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-4 text-sm text-[var(--text-muted)]">
            Carregando cursos…
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-4 text-sm text-[var(--text-muted)]">
            Nenhum curso encontrado.
          </div>
        ) : (
          courses.map((c) => {
            const lessonIds = flattenLessonIds(c);
            const selectedInCourse = lessonIds.filter((id) => selectedLessonIds.has(id)).length;
            const courseChecked = selectedInCourse > 0;
            const expanded = expandedCourseIds.has(c.id);
            const totalLessons = toLessonCount(c);
            const allLessonsSelectedInCourse = totalLessons > 0 && selectedInCourse === totalLessons;
            const hasAnyPdf = c.modules.some((m) => m.lessons.some((l) => (l.pdfUrl ?? "").trim()));

            return (
              <div key={c.id} className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Checkbox
                      checked={courseChecked}
                      onCheckedChange={(v) => setCourseSelected(c, Boolean(v))}
                      disabled={exporting}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[var(--text-primary)]">{c.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {c.status}
                        {c.workloadHours != null ? ` • ${c.workloadHours}h` : ""} • {selectedInCourse}/{totalLessons} aulas
                        {hasAnyPdf ? " • PDFs disponíveis" : " • Sem PDFs (aulas podem ter apenas resumo/anexos)"}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => selectAllLessonsOfCourse(c, true)}
                      disabled={exporting || totalLessons === 0}
                    >
                      Selecionar aulas do curso
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => selectAllLessonsOfCourse(c, false)}
                      disabled={exporting || totalLessons === 0}
                    >
                      Limpar aulas do curso
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => toggleExpand(c.id)}>
                      {expanded ? "Ocultar" : "Ver aulas"}
                    </Button>
                  </div>
                </div>

                {expanded ? (
                  <div className="border-t border-[var(--card-border)] px-4 py-3">
                    {c.modules.map((m) => (
                      <div key={m.id} className="mb-3 last:mb-0">
                        <div className="text-sm font-semibold text-[var(--text-secondary)]">
                          Módulo {m.order + 1}: {m.title}
                        </div>
                        {m.description ? <div className="text-xs text-[var(--text-muted)]">{m.description}</div> : null}

                        <div className="mt-2 space-y-1">
                          {m.lessons.map((l) => {
                            const checked = selectedLessonIds.has(l.id);
                            const hasPdf = (l.pdfUrl ?? "").trim().length > 0;
                            return (
                              <label key={l.id} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-black/5">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => setLessonSelected(c, l.id, Boolean(v))}
                                  disabled={exporting}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm text-[var(--text-primary)]">
                                    Aula {l.order + 1}: {l.title}
                                  </div>
                                  <div className="text-xs text-[var(--text-muted)]">
                                    {l.durationMinutes != null ? `${l.durationMinutes} min • ` : ""}
                                    {hasPdf ? "PDF OK" : "Sem PDF"}
                                    {(l.attachmentUrls?.length ?? 0) > 0 ? ` • ${l.attachmentUrls.length} anexo(s)` : ""}
                                    {(l.summary ?? "").trim() ? " • Resumo OK" : " • Sem resumo"}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <div className="mt-3 text-xs text-[var(--text-muted)]">
                      {allLessonsSelectedInCourse ? "Todas as aulas deste curso estão selecionadas." : ""}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

