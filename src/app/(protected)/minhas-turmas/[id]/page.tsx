"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DashboardTutorial, type TutorialStep } from "@/components/dashboard/DashboardTutorial";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Badge } from "@/components/ui/Badge";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type EnrollmentDetail = {
  id: string;
  classGroupId: string;
  course: { name: string; description: string | null; workloadHours: number | null };
  teacher: string;
  teacherPhotoUrl: string | null;
  daysOfWeek: string[];
  startDate: string;
  endDate: string | null;
  status: string;
  location: string | null;
  startTime: string;
  endTime: string;
  certificateUrl: string | null;
  certificateFileName: string | null;
  sessions: Array<{
    id: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    status: string;
    lessonTitle: string;
    lesson: {
      id: string;
      title: string;
      order: number;
      durationMinutes: number | null;
      videoUrl: string | null;
      contentRich: string | null;
      imageUrls: string[];
    } | null;
  }>;
};

const STATUS_TONE: Record<string, "zinc" | "green" | "red" | "blue" | "amber" | "violet"> = {
  PLANEJADA: "zinc",
  ABERTA: "blue",
  EM_ANDAMENTO: "amber",
  ENCERRADA: "green",
  CANCELADA: "red",
  INTERNO: "violet",
  EXTERNO: "blue",
  SCHEDULED: "zinc",
  LIBERADA: "green",
  CANCELED: "red",
};

const STATUS_LABEL: Record<string, string> = {
  PLANEJADA: "Planejada",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
  INTERNO: "Interno",
  EXTERNO: "Externo",
  SCHEDULED: "Agendada",
  LIBERADA: "Liberada",
  CANCELED: "Cancelada",
};

export default function MinhasTurmasDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const toast = useToast();
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ enrollment: EnrollmentDetail } | null>(null);

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/me/enrollments/${id}`);
        const json = (await res.json()) as ApiResponse<{ enrollment: EnrollmentDetail }>;
        if (res.ok && json?.ok) setData(json.data);
        else toast.push("error", (json && "error" in json ? (json as { error?: { message?: string } }).error?.message : "Falha ao carregar detalhes.") ?? "Falha ao carregar detalhes.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, toast]);

  const tutorialSteps: TutorialStep[] = useMemo(() => {
    if (!data) return [];
    const e = data.enrollment;
    const hasConteudo = e.sessions.some((s) => s.status === "LIBERADA");
    const steps: TutorialStep[] = [
      {
        target: "[data-tour=\"mt-header\"]",
        title: "Detalhe da matrícula",
        content: "Aqui você vê o nome do curso e o status da sua matrícula nesta turma.",
      },
      {
        target: "[data-tour=\"mt-info\"]",
        title: "Informações da turma",
        content: "Carga horária, professor, dias da semana, datas e local aparecem neste bloco.",
      },
      {
        target: "[data-tour=\"mt-aulas\"]",
        title: "Data e horário das aulas",
        content: "Confira as datas e o status de cada aula do curso.",
      },
      {
        target: "[data-tour=\"mt-voltar\"]",
        title: "Voltar às turmas",
        content: "Use este link para retornar à lista de todas as suas turmas.",
      },
    ];
    if (hasConteudo) {
      steps.splice(2, 0, {
        target: "[data-tour=\"mt-acessar-conteudo\"]",
        title: "Acessar conteúdo",
        content: "Clique aqui para abrir o conteúdo do curso, assistir às aulas e fazer os exercícios.",
      });
    }
    steps.push({
      target: null,
      title: "Tudo pronto!",
      content: "Agora você já conhece esta tela. Acesse o conteúdo quando quiser começar ou continuar as aulas.",
    });
    return steps;
  }, [data]);

  /** Formata ISO date ou date-time em pt-BR. Usa só a parte da data para evitar dia errado em fusos à esquerda de UTC. */
  function formatDate(iso: string) {
    if (!iso) return "";
    const datePart = /^\d{4}-\d{2}-\d{2}/.exec(iso)?.[0];
    if (datePart) {
      const [y, m, d] = datePart.split("-");
      return `${d}/${m}/${y}`;
    }
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  if (loading || !data) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <Link
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          href="/minhas-turmas"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
          Voltar às turmas
        </Link>
        <div className="card">
          <div className="card-body py-10 text-center text-[var(--text-secondary)]">
            {loading ? "Carregando turma..." : "Turma não encontrada."}
          </div>
        </div>
      </div>
    );
  }

  const e = data.enrollment;
  const hasConteudo = e.sessions.some((s) => s.status === "LIBERADA");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <nav aria-label="Navegação">
        <Link
          data-tour="mt-voltar"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
          href="/minhas-turmas"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--igh-primary)]" aria-hidden />
          Voltar às turmas
        </Link>
      </nav>

      <div className="card">
        <header className="card-header" data-tour="mt-header">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            {e.course.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[e.status] ?? "zinc"}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
          </div>
        </header>
        <div className="card-body space-y-8">
          {e.course.description ? (
            <section aria-labelledby="desc-heading">
              <h2 id="desc-heading" className="text-base font-semibold text-[var(--text-primary)]">
                Descrição do curso
              </h2>
              <p className="mt-2 leading-relaxed text-[var(--text-secondary)]">{e.course.description}</p>
            </section>
          ) : null}

          <section
            data-tour="mt-info"
            className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4 sm:p-5"
            aria-labelledby="info-heading"
          >
            <h2 id="info-heading" className="sr-only">Informações da turma</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Carga horária</div>
                <p className="mt-1 text-[var(--text-primary)]">{e.course.workloadHours != null ? `${e.course.workloadHours} horas` : "—"}</p>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Professor</div>
                <div className="mt-1 flex items-center gap-2 text-[var(--text-primary)]">
                  {e.teacherPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.teacherPhotoUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-[var(--card-border)]"
                    />
                  ) : (
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--igh-surface)] text-xs font-semibold text-[var(--text-muted)] ring-1 ring-[var(--card-border)]"
                      aria-hidden
                    >
                      {e.teacher
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase() || "?"}
                    </span>
                  )}
                  <span>{e.teacher}</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Dias da semana</div>
                <p className="mt-1 text-[var(--text-primary)]">{e.daysOfWeek?.length ? e.daysOfWeek.join(", ") : "—"}</p>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Data de início</div>
                <p className="mt-1 text-[var(--text-primary)]">{formatDate(e.startDate)}</p>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Status</div>
                <p className="mt-1">
                  <Badge tone={STATUS_TONE[e.status] ?? "zinc"}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
                </p>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Local</div>
                <p className="mt-1 text-[var(--text-primary)]">{e.location ?? "—"}</p>
              </div>
            </div>
          </section>

          {e.certificateUrl ? (
            <section aria-labelledby="cert-heading">
              <h2 id="cert-heading" className="text-base font-semibold text-[var(--text-primary)]">
                Certificado
              </h2>
              <p className="mt-2">
                <a
                  href={e.certificateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
                >
                  {e.certificateFileName || "Ver certificado"}
                </a>
              </p>
            </section>
          ) : null}

          {hasConteudo ? (
            <div>
              <Link
                data-tour="mt-acessar-conteudo"
                href={`/minhas-turmas/${e.id}/conteudo`}
                className="inline-flex items-center rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
              >
                Acessar conteúdo do curso
              </Link>
            </div>
          ) : null}

          <section aria-labelledby="aulas-heading" data-tour="mt-aulas">
            <h2 id="aulas-heading" className="mb-3 text-base font-semibold text-[var(--text-primary)]">
              Data e horário das aulas
            </h2>
            {e.sessions.length === 0 ? (
              <div
                className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-8 text-center"
                role="status"
              >
                <p className="text-sm text-[var(--text-muted)]">Nenhuma aula agendada.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--card-border)]">
                <Table>
                  <thead>
                    <tr>
                      <Th>Data</Th>
                      <Th>Horário</Th>
                      <Th>Aula do curso</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.sessions.map((s) => (
                      <tr key={s.id}>
                        <Td>{formatDate(s.sessionDate)}</Td>
                        <Td>{s.startTime} às {s.endTime}</Td>
                        <Td>{s.lessonTitle}</Td>
                        <Td>
                          <Badge tone={STATUS_TONE[s.status] ?? "zinc"}>
                            {STATUS_LABEL[s.status] ?? s.status}
                          </Badge>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </section>
        </div>
      </div>

      <DashboardTutorial
        showForStudent={user.role !== "MASTER"}
        steps={tutorialSteps}
        storageKey="minhas-turmas-detail-tutorial-done"
      />
    </div>
  );
}
