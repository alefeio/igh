"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type Course = { id: string; name: string };
type ClassGroup = {
  id: string;
  courseId: string;
  course: { id: string; name: string };
  startTime: string;
  endTime: string;
};
type Template = {
  id: string;
  name: string;
  subjectTemplate: string;
  htmlContent: string | null;
  textContent: string | null;
};
type StudentOption = { id: string; name: string };

const AUDIENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL_STUDENTS", label: "Todos os alunos" },
  { value: "ENROLLED_STUDENTS", label: "Alunos matriculados" },
  { value: "CLASS_GROUP", label: "Turma específica" },
  { value: "SPECIFIC_STUDENTS", label: "Alunos específicos" },
  { value: "STUDENTS_INCOMPLETE", label: "Alunos com cadastro incompleto" },
  { value: "STUDENTS_COMPLETE", label: "Alunos com cadastro completo" },
  { value: "STUDENTS_ACTIVE", label: "Alunos ativos" },
  { value: "STUDENTS_INACTIVE", label: "Alunos inativos" },
  { value: "BY_COURSE", label: "Alunos por curso" },
  { value: "TEACHERS", label: "Professores" },
  { value: "ADMINS", label: "Admins" },
  { value: "ALL_ACTIVE_USERS", label: "Todos os usuários ativos" },
];

export default function NovaCampanhaEmailPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audienceType, setAudienceType] = useState("ALL_STUDENTS");
  const [classGroupId, setClassGroupId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [textContent, setTextContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const [selectedStudents, setSelectedStudents] = useState<StudentOption[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const [studentSearchResults, setStudentSearchResults] = useState<StudentOption[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const studentComboboxRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [coursesRes, classGroupsRes, templatesRes] = await Promise.all([
          fetch("/api/courses"),
          fetch("/api/class-groups"),
          fetch("/api/email/templates?activeOnly=true"),
        ]);
        const coursesJson = (await coursesRes.json()) as ApiResponse<{
          courses: Course[];
        }>;
        const cgJson = (await classGroupsRes.json()) as ApiResponse<{
          classGroups: ClassGroup[];
        }>;
        const tJson = (await templatesRes.json()) as ApiResponse<{
          items: Template[];
        }>;
        if (coursesJson.ok) setCourses(coursesJson.data.courses ?? []);
        if (cgJson.ok) setClassGroups(cgJson.data.classGroups ?? []);
        if (tJson.ok) setTemplates(tJson.data.items ?? []);
      } catch {
        // ignore
      }
    })();
  }, []);

  const searchStudents = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setStudentSearchResults([]);
      return;
    }
    setStudentSearchLoading(true);
    try {
      const res = await fetch(
        `/api/students?${new URLSearchParams({ q: trimmed }).toString()}`
      );
      const json = (await res.json()) as ApiResponse<{
        students: { id: string; name: string }[];
      }>;
      if (json.ok && Array.isArray(json.data?.students)) {
        setStudentSearchResults(
          json.data.students.map((s) => ({ id: s.id, name: s.name }))
        );
      } else {
        setStudentSearchResults([]);
      }
    } catch {
      setStudentSearchResults([]);
    } finally {
      setStudentSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (audienceType !== "SPECIFIC_STUDENTS") return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      void searchStudents(studentSearch);
    }, 280);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [studentSearch, audienceType, searchStudents]);

  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      if (
        studentComboboxRef.current &&
        !studentComboboxRef.current.contains(ev.target as Node)
      ) {
        setStudentDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.push("error", "Nome da campanha é obrigatório.");
      return;
    }
    if (audienceType === "CLASS_GROUP" && !classGroupId) {
      toast.push("error", "Selecione uma turma.");
      return;
    }
    if (audienceType === "BY_COURSE" && !courseId) {
      toast.push("error", "Selecione um curso.");
      return;
    }
    if (audienceType === "SPECIFIC_STUDENTS" && selectedStudents.length === 0) {
      toast.push("error", "Selecione ao menos um aluno.");
      return;
    }
    const hasHtml = htmlContent.trim() !== "";
    const hasText = textContent.trim() !== "";
    if (!hasHtml && !hasText) {
      toast.push("error", "Informe o conteúdo em HTML e/ou texto.");
      return;
    }
    if (!subject.trim()) {
      toast.push("error", "Assunto do e-mail é obrigatório.");
      return;
    }
    setLoading(true);
    try {
      let audienceFilters: Record<string, unknown> | null = null;
      if (audienceType === "CLASS_GROUP") {
        audienceFilters = { classGroupId };
      } else if (audienceType === "BY_COURSE") {
        audienceFilters = { courseId };
      } else if (audienceType === "SPECIFIC_STUDENTS") {
        audienceFilters = {
          studentIds: selectedStudents.map((s) => s.id),
        };
      }
      const res = await fetch("/api/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          audienceType,
          audienceFilters,
          templateId: templateId || null,
          subject: subject.trim() || null,
          htmlContent: hasHtml ? htmlContent.trim() : null,
          textContent: hasText ? textContent.trim() : null,
          scheduledAt: scheduledAt.trim() || null,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ campaign: { id: string } }>;
      if (!res.ok || !json.ok) {
        toast.push(
          "error",
          !json.ok ? json.error?.message ?? "Falha ao criar campanha." : "Falha ao criar."
        );
        return;
      }
      toast.push(
        "success",
        "Campanha criada. Revise e confirme o envio na próxima tela."
      );
      router.push(`/admin/email/${json.data.campaign.id}`);
    } finally {
      setLoading(false);
    }
  }

  const filteredDropdown = studentSearchResults.filter(
    (s) => !selectedStudents.some((x) => x.id === s.id)
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <Link
          href="/admin/email"
          className="text-[var(--igh-primary)] hover:underline"
        >
          ← Campanhas
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold text-[var(--text-primary)]">
        Nova campanha de E-mail
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
            Nome *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Comunicado matrícula"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
            Descrição (opcional)
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição interna"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
            Público
          </label>
          <select
            value={audienceType}
            onChange={(e) => {
              setAudienceType(e.target.value);
              setStudentSearch("");
              setStudentSearchResults([]);
            }}
            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          >
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {audienceType === "CLASS_GROUP" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Turma
            </label>
            <select
              value={classGroupId}
              onChange={(e) => setClassGroupId(e.target.value)}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              required
            >
              <option value="">Selecione</option>
              {classGroups.map((cg) => (
                <option key={cg.id} value={cg.id}>
                  {cg.course.name} — {cg.startTime}-{cg.endTime}
                </option>
              ))}
            </select>
          </div>
        )}
        {audienceType === "SPECIFIC_STUDENTS" && (
          <div ref={studentComboboxRef} className="space-y-2">
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Alunos
            </label>
            <p className="text-xs text-[var(--text-muted)]">
              Digite pelo menos 2 caracteres do nome para buscar. Clique no aluno para
              adicionar.
            </p>
            <div className="relative">
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setStudentDropdownOpen(true);
                }}
                onFocus={() => setStudentDropdownOpen(true)}
                placeholder="Buscar aluno por nome..."
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                autoComplete="off"
              />
              {studentDropdownOpen && studentSearch.trim().length >= 2 && (
                <ul
                  className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded border border-[var(--card-border)] bg-[var(--card-bg)] py-1 shadow-lg"
                  role="listbox"
                >
                  {studentSearchLoading ? (
                    <li className="px-3 py-2 text-sm text-[var(--text-muted)]">
                      Buscando...
                    </li>
                  ) : filteredDropdown.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-[var(--text-muted)]">
                      Nenhum aluno encontrado ou já selecionado.
                    </li>
                  ) : (
                    filteredDropdown.map((s) => (
                      <li
                        key={s.id}
                        role="option"
                        className="cursor-pointer px-3 py-2 text-sm hover:bg-[var(--igh-surface)]"
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          setSelectedStudents((prev) =>
                            prev.some((x) => x.id === s.id)
                              ? prev
                              : [...prev, s]
                          );
                          setStudentSearch("");
                          setStudentSearchResults([]);
                          setStudentDropdownOpen(false);
                        }}
                      >
                        {s.name}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            {selectedStudents.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {selectedStudents.map((s) => (
                  <li
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--igh-surface)] py-1 pl-3 pr-1 text-sm text-[var(--text-primary)]"
                  >
                    <span className="max-w-[200px] truncate">{s.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedStudents((prev) =>
                          prev.filter((x) => x.id !== s.id)
                        )
                      }
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950 dark:hover:text-red-300"
                      aria-label={`Remover ${s.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {audienceType === "BY_COURSE" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Curso
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              required
            >
              <option value="">Selecione</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
            Template (opcional)
          </label>
          <select
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              const t = templates.find((x) => x.id === e.target.value);
              if (t) {
                setSubject(t.subjectTemplate);
                setHtmlContent(t.htmlContent ?? "");
                setTextContent(t.textContent ?? "");
              }
            }}
            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          >
            <option value="">Conteúdo manual</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
            Assunto do e-mail *
          </label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex.: Lembrete: matrícula aberta"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
            Conteúdo HTML (opcional)
          </label>
          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            placeholder="Corpo em HTML. Placeholders: {nome}, {primeiro_nome}, {turma}, {curso}, {unidade}, {link}"
            rows={6}
            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
            Conteúdo texto (opcional, fallback se sem HTML)
          </label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Versão em texto simples"
            rows={4}
            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Informe pelo menos HTML ou texto.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
            Agendar para (opcional)
          </label>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Criando..." : "Criar campanha"}
          </Button>
          <Link href="/admin/email">
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
