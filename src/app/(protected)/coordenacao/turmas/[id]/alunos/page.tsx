"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CoordinatorOccurrenceButton } from "@/components/coordenacao/CoordinatorOccurrenceButton";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import type { ApiResponse } from "@/lib/api-types";

type StudentRow = {
  enrollmentId: string;
  name: string;
  phone: string | null;
  status: string;
  statusLabel: string;
  attendancePresent: number;
  attendanceTotal: number;
  attendancePercent: number | null;
  unjustifiedAbsences: number;
  justifiedAbsences: number;
  participationPercent: number | null;
  lessonsCompleted: number;
  lessonsTotal: number;
  exercisesAnswered: number;
  history: { at: string; label: string }[];
};

type Payload = {
  classGroup: {
    id: string;
    courseName: string;
    teachers: string[];
    schedule: string;
    cycleId: string;
    cycleLabel: string;
  };
  students: StudentRow[];
};

function whatsappUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
}

function percent(value: number | null) {
  return value == null ? "sem dado" : `${value}%`;
}

function textDate(value: string) {
  if (!value) return "não registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "não registrada";
  return date.toLocaleDateString("pt-BR");
}

function statusClass(status: string) {
  if (status === "ACTIVE") return "shrink-0 text-xs font-bold text-green-700 dark:text-green-400";
  if (status === "CANCELLED") return "shrink-0 text-xs font-bold text-red-600 dark:text-red-400";
  return "shrink-0 text-xs font-medium text-[var(--text-muted)]";
}

export default function CoordenacaoTurmaAlunosPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [missing, setMissing] = useState(false);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/coordenacao/turmas/${params.id}/alunos`, { cache: "no-store" });
    const json = (await res.json()) as ApiResponse<Payload>;
    if (!res.ok || !json.ok) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setData(json.data);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (missing) return <p className="text-sm text-[var(--text-muted)]">Turma não encontrada.</p>;
  if (!data) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;

  const group = data.classGroup;

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        eyebrow="Lista da turma"
        title={group.courseName}
        description={[group.teachers.join(", "), group.schedule, group.cycleLabel].filter(Boolean).join(" · ")}
      />
      <p className="text-sm">
        <Link className="font-medium text-[var(--igh-primary)]" href={`/coordenacao/frequencia?cycleId=${group.cycleId}`}>
          Voltar à frequência
        </Link>
      </p>
      <SectionCard
        title="Alunos"
        description="Frequência conta só aulas a partir da matrícula. Participação é o percentual de aulas concluídas no curso."
        variant="elevated"
      >
        {data.students.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum aluno nesta turma.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.students.map((student) => {
              const whatsapp = student.phone ? whatsappUrl(student.phone) : null;
              const historyOpen = openHistoryId === student.enrollmentId;
              return (
                <li key={student.enrollmentId} className="rounded-lg border border-[var(--card-border)] px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-[var(--text-primary)]">{student.name}</p>
                    <p className={statusClass(student.status)}>{student.statusLabel}</p>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Frequência {percent(student.attendancePercent)} ({student.attendancePresent}/{student.attendanceTotal}).{" "}
                    {student.unjustifiedAbsences} falta(s) sem justificativa
                    {student.justifiedAbsences > 0 ? ` e ${student.justifiedAbsences} justificada(s)` : ""}.
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Participação {percent(student.participationPercent)}
                    {student.lessonsTotal > 0 ? ` (${student.lessonsCompleted}/${student.lessonsTotal} aulas)` : ""}. Exercícios
                    respondidos: {student.exercisesAnswered}.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {whatsapp ? (
                      <a
                        className="text-sm font-medium text-[var(--igh-primary)]"
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp
                      </a>
                    ) : (
                      <span className="text-sm text-[var(--text-muted)]">Sem telefone</span>
                    )}
                    <Link className="text-sm text-[var(--igh-primary)]" href={`/coordenacao/alunos/${student.enrollmentId}`}>
                      Abrir ficha
                    </Link>
                    <CoordinatorOccurrenceButton
                      enrollmentId={student.enrollmentId}
                      studentName={student.name}
                    />
                    <button
                      type="button"
                      className="text-sm font-medium text-[var(--igh-primary)]"
                      onClick={() => setOpenHistoryId(historyOpen ? null : student.enrollmentId)}
                    >
                      {historyOpen ? "Ocultar histórico" : "Histórico"}
                    </button>
                  </div>
                  {historyOpen ? (
                    student.history.length === 0 ? (
                      <p className="mt-3 text-sm text-[var(--text-muted)]">Nenhum registro no histórico.</p>
                    ) : (
                      <ul className="mt-3 space-y-1 border-t border-[var(--card-border)] pt-3 text-sm text-[var(--text-secondary)]">
                        {student.history.map((item) => (
                          <li key={`${item.at}-${item.label}`}>
                            {textDate(item.at)} · {item.label}
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
