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

const STATUS_TONE: Record<string, "zinc" | "green" | "red" | "blue" | "amber"> = {
  PLANEJADA: "zinc",
  ABERTA: "blue",
  EM_ANDAMENTO: "amber",
  ENCERRADA: "green",
  CANCELADA: "red",
};

const STATUS_LABEL: Record<string, string> = {
  PLANEJADA: "Planejada",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
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

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="card-header">
          <div className="text-lg font-semibold text-[var(--text-primary)]">Minhas turmas</div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">Turmas em que você está matriculado.</div>
        </div>
        <div className="card-body">
          {loading ? (
            <p className="text-[var(--text-secondary)]">Carregando...</p>
          ) : enrollments.length === 0 ? (
            <p className="text-[var(--text-secondary)]">Você não está matriculado em nenhuma turma no momento.</p>
          ) : (
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
                      <Link className="text-blue-600 underline hover:no-underline" href={`/minhas-turmas/${e.id}`}>
                        Ver detalhes
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
