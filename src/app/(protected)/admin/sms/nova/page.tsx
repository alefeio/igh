"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

type Course = { id: string; name: string };
type ClassGroup = { id: string; courseId: string; course: { id: string; name: string }; startTime: string; endTime: string };

const AUDIENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL_STUDENTS", label: "Todos os alunos" },
  { value: "CLASS_GROUP", label: "Turma específica" },
  { value: "STUDENTS_INCOMPLETE", label: "Alunos com cadastro incompleto" },
  { value: "STUDENTS_COMPLETE", label: "Alunos com cadastro completo" },
  { value: "STUDENTS_ACTIVE", label: "Alunos ativos" },
  { value: "STUDENTS_INACTIVE", label: "Alunos inativos" },
  { value: "BY_COURSE", label: "Alunos por curso" },
  { value: "TEACHERS", label: "Professores" },
  { value: "ADMINS", label: "Admins" },
  { value: "ALL_ACTIVE_USERS", label: "Todos os usuários ativos" },
];

export default function NovaCampanhaPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string; content: string }[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audienceType, setAudienceType] = useState("ALL_STUDENTS");
  const [classGroupId, setClassGroupId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [coursesRes, classGroupsRes, templatesRes] = await Promise.all([
          fetch("/api/courses"),
          fetch("/api/class-groups"),
          fetch("/api/sms/templates?activeOnly=true"),
        ]);
        const coursesJson = (await coursesRes.json()) as ApiResponse<{ courses: Course[] }>;
        const cgJson = (await classGroupsRes.json()) as ApiResponse<{ classGroups: ClassGroup[] }>;
        const tJson = (await templatesRes.json()) as ApiResponse<{ items: { id: string; name: string; content: string }[] }>;
        if (coursesJson.ok) setCourses(coursesJson.data.courses ?? []);
        if (cgJson.ok) setClassGroups(cgJson.data.classGroups ?? []);
        if (tJson.ok) setTemplates(tJson.data.items ?? []);
      } catch {
        // ignore
      }
    })();
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
    const content = templateId
      ? (templates.find((t) => t.id === templateId)?.content ?? messageContent)
      : messageContent;
    if (!content.trim()) {
      toast.push("error", "Informe a mensagem ou selecione um template.");
      return;
    }
    setLoading(true);
    try {
      const audienceFilters =
        audienceType === "CLASS_GROUP"
          ? { classGroupId }
          : audienceType === "BY_COURSE"
            ? { courseId }
            : undefined;
      const res = await fetch("/api/sms/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          audienceType,
          audienceFilters: audienceFilters ?? null,
          templateId: templateId || null,
          messageContent: content.trim() || null,
          scheduledAt: scheduledAt.trim() || null,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ campaign: { id: string } }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error?.message ?? "Falha ao criar campanha." : "Falha ao criar.");
        return;
      }
      toast.push("success", "Campanha criada. Revise e confirme o envio na próxima tela.");
      router.push(`/admin/sms/${json.data.campaign.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <Link href="/admin/sms" className="text-[var(--igh-primary)] hover:underline">← Campanhas</Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold text-[var(--text-primary)]">Nova campanha SMS</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Nome *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Lembrete matrícula"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Descrição (opcional)</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição interna"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Público</label>
          <select
            value={audienceType}
            onChange={(e) => setAudienceType(e.target.value)}
            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          >
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {audienceType === "CLASS_GROUP" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Turma</label>
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
        {audienceType === "BY_COURSE" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Curso</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              required
            >
              <option value="">Selecione</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Template (opcional)</label>
          <select
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              const t = templates.find((x) => x.id === e.target.value);
              if (t) setMessageContent(t.content);
            }}
            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          >
            <option value="">Mensagem manual</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Mensagem *</label>
          <textarea
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            placeholder="Texto do SMS. Use {nome}, {primeiro_nome}, {turma}, {curso}, {unidade}, {link}"
            rows={4}
            maxLength={1600}
            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            required
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">{messageContent.length} / 1600</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Agendar para (opcional)</label>
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
          <Link href="/admin/sms">
            <Button type="button" variant="secondary">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
