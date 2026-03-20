"use client";

import { GraduationCap, LayoutDashboard, Star, UserCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardHero, QuickActionGrid, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type EnrollmentItem = {
  id: string;
  classGroupId: string;
  courseName: string;
  teacherName: string;
  teacherPhotoUrl: string | null;
  startDate: string;
  status: string;
  location: string | null;
};

const STATUS_TONE: Record<string, "zinc" | "green" | "red" | "blue" | "amber" | "violet"> = {
  PLANEJADA: "zinc",
  ABERTA: "blue",
  EM_ANDAMENTO: "amber",
  ENCERRADA: "green",
  CANCELADA: "red",
  INTERNO: "violet",
  EXTERNO: "blue",
};

const STATUS_LABEL: Record<string, string> = {
  PLANEJADA: "Planejada",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
  INTERNO: "Interno",
  EXTERNO: "Externo",
};

export default function MinhasTurmasPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/me/enrollments");
        const json = (await res.json()) as ApiResponse<{ enrollments: EnrollmentItem[] }>;
        if (res.ok && json?.ok) setEnrollments(json.data.enrollments);
        else toast.push("error", "Falha ao carregar turmas.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [toast]);

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

  const subtitle = loading
    ? "Carregando turmas em que você está matriculado…"
    : enrollments.length === 0
      ? "Você não está matriculado em nenhuma turma no momento."
      : `${enrollments.length} ${enrollments.length === 1 ? "matrícula ativa" : "matrículas ativas"}`;

  return (
    <div className="flex min-w-0 flex-col gap-8 pb-4 sm:gap-10">
      <nav aria-label="Navegação" className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/minhas-turmas/favoritos"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-amber-500/40 hover:bg-amber-500/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
        >
          <Star className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          Minha lista de favoritos
        </Link>
      </nav>

      <DashboardHero
        eyebrow="Área do aluno"
        title="Minhas turmas"
        description={subtitle}
      />

      <SectionCard
        title="Suas matrículas"
        description="Curso, professor, datas e status — abra os detalhes para acessar conteúdo e exercícios."
        variant="elevated"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-14" role="status">
            <div className="h-12 w-12 animate-pulse rounded-2xl bg-[var(--igh-primary)]/20" aria-hidden />
            <p className="mt-4 text-sm font-medium text-[var(--text-muted)]">Carregando turmas…</p>
          </div>
        ) : enrollments.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-6 py-14 text-center"
            role="status"
          >
            <GraduationCap className="mx-auto h-12 w-12 text-[var(--text-muted)]" aria-hidden />
            <p className="mt-4 text-sm font-medium text-[var(--text-muted)]">
              Você não está matriculado em nenhuma turma no momento.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--igh-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[var(--igh-primary)]/20 transition hover:opacity-95"
            >
              Ir ao painel
            </Link>
          </div>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Curso</Th>
                <Th>Professor</Th>
                <Th>Início</Th>
                <Th>Status</Th>
                <Th>Local</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id}>
                  <Td>{e.courseName}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {e.teacherPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.teacherPhotoUrl}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[var(--card-border)]"
                        />
                      ) : (
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--igh-surface)] text-xs font-semibold text-[var(--text-muted)] ring-1 ring-[var(--card-border)]"
                          aria-hidden
                        >
                          {e.teacherName
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join("")
                            .toUpperCase() || "?"}
                        </span>
                      )}
                      <span>{e.teacherName}</span>
                    </div>
                  </Td>
                  <Td>{formatDate(e.startDate)}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[e.status] ?? "zinc"}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
                  </Td>
                  <Td>{e.location ?? "—"}</Td>
                  <Td>
                    <Link
                      href={`/minhas-turmas/${e.id}`}
                      className="font-semibold text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
                    >
                      Ver detalhes
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </SectionCard>

      <section aria-label="Atalhos">
        <h2 className="mb-1 text-lg font-bold text-[var(--text-primary)]">Atalhos úteis</h2>
        <p className="mb-4 text-sm text-[var(--text-muted)]">Acesso rápido ao que você usa com frequência.</p>
        <QuickActionGrid
          items={[
            {
              href: "/dashboard",
              label: "Painel inicial",
              description: "Resumo e progresso",
              icon: LayoutDashboard,
              accent: "from-[var(--igh-primary)] to-violet-600",
            },
            {
              href: "/minhas-turmas/favoritos",
              label: "Favoritos",
              description: "Aulas salvas para revisar",
              icon: Star,
              accent: "from-amber-500 to-orange-600",
            },
            {
              href: "/meus-dados",
              label: "Meus dados",
              description: "Cadastro e documentos",
              icon: UserCircle,
              accent: "from-emerald-500 to-teal-600",
            },
          ]}
        />
      </section>
    </div>
  );
}
