"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type EnrollmentDetail = {
  id: string;
  classGroupId: string;
  course: { name: string; description: string | null; workloadHours: number | null };
  teacher: string;
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
  }>;
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
  SCHEDULED: "Agendada",
  CANCELED: "Cancelada",
};

export default function MinhasTurmasDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const toast = useToast();
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
        else toast.push("error", json && "error" in json ? json.error.message : "Falha ao carregar detalhes.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, toast]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  if (loading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Link className="text-sm text-blue-600 underline" href="/minhas-turmas">
          ← Voltar às turmas
        </Link>
        <div className="card">
          <div className="card-body">{loading ? "Carregando..." : "Turma não encontrada."}</div>
        </div>
      </div>
    );
  }

  const e = data.enrollment;

  return (
    <div className="flex flex-col gap-4">
      <Link className="text-sm text-blue-600 underline" href="/minhas-turmas">
        ← Voltar às turmas
      </Link>

      <div className="card">
        <div className="card-header">
          <div className="text-lg font-semibold">{e.course.name}</div>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={STATUS_TONE[e.status] ?? "zinc"}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
          </div>
        </div>
        <div className="card-body space-y-6">
          {e.course.description ? (
            <div>
              <div className="text-sm font-medium text-zinc-600">Descrição do curso</div>
              <p className="mt-1 text-zinc-800">{e.course.description}</p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-zinc-600">Carga horária</div>
              <p className="mt-1">{e.course.workloadHours != null ? `${e.course.workloadHours} horas` : "—"}</p>
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-600">Professor</div>
              <p className="mt-1">{e.teacher}</p>
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-600">Dias da semana</div>
              <p className="mt-1">{e.daysOfWeek?.length ? e.daysOfWeek.join(", ") : "—"}</p>
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-600">Data de início</div>
              <p className="mt-1">{formatDate(e.startDate)}</p>
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-600">Status</div>
              <p className="mt-1">
                <Badge tone={STATUS_TONE[e.status] ?? "zinc"}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
              </p>
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-600">Local</div>
              <p className="mt-1">{e.location ?? "—"}</p>
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-600">Horário</div>
              <p className="mt-1">{e.startTime} às {e.endTime}</p>
            </div>
          </div>

          {e.certificateUrl ? (
            <div>
              <div className="text-sm font-medium text-zinc-600">Certificado</div>
              <p className="mt-1">
                <a
                  href={e.certificateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:no-underline"
                >
                  {e.certificateFileName || "Ver certificado"}
                </a>
              </p>
            </div>
          ) : null}

          <div>
            <div className="mb-2 text-sm font-medium text-zinc-600">Data e horário das aulas</div>
            {e.sessions.length === 0 ? (
              <p className="text-zinc-600">Nenhuma aula agendada.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Data</Th>
                    <Th>Horário</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {e.sessions.map((s) => (
                    <tr key={s.id}>
                      <Td>{formatDate(s.sessionDate)}</Td>
                      <Td>{s.startTime} às {s.endTime}</Td>
                      <Td>
                        <Badge tone={s.status === "CANCELED" ? "red" : "zinc"}>
                          {STATUS_LABEL[s.status] ?? s.status}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
