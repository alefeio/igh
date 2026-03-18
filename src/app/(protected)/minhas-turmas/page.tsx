"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type EnrollmentItem = {
  id: string;
  classGroupId: string;
  courseName: string;
  teacherName: string;
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

  return (
    <div className="container-page flex flex-col gap-6">
      <nav aria-label="Navegação" className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/minhas-turmas/favoritos"
          className="text-sm font-medium text-[var(--igh-primary)] underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
        >
          ★ Minha lista de favoritos
        </Link>
      </nav>

      <div className="card">
        <header className="card-header">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            Minhas turmas
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {loading
              ? "Turmas em que você está matriculado."
              : enrollments.length === 0
                ? "Você não está matriculado em nenhuma turma no momento."
                : `${enrollments.length} ${enrollments.length === 1 ? "turma" : "turmas"}`}
          </p>
        </header>
        <div className="card-body">
          {loading ? (
            <div className="py-10 text-center text-[var(--text-secondary)]" role="status">
              Carregando turmas...
            </div>
          ) : enrollments.length === 0 ? (
            <div
              className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-10 text-center"
              role="status"
            >
              <p className="text-sm text-[var(--text-muted)]">
                Você não está matriculado em nenhuma turma no momento.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--card-border)]">
              <Table>
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
                      <Td>{e.teacherName}</Td>
                      <Td>{formatDate(e.startDate)}</Td>
                      <Td>
                        <Badge tone={STATUS_TONE[e.status] ?? "zinc"}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
                      </Td>
                      <Td>{e.location ?? "—"}</Td>
                      <Td>
                        <Link
                          href={`/minhas-turmas/${e.id}`}
                          className="text-[var(--igh-primary)] font-medium underline hover:no-underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2 rounded"
                        >
                          Ver detalhes
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
