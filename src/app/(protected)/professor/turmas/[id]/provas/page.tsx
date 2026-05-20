"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ApiErr, ApiResponse } from "@/lib/api-types";

type ExamRow = {
  id: string;
  title: string;
  status: string;
  availableFrom: string;
  availableUntil: string;
  durationMinutes: number;
  timingMode: string;
  questionCount: number;
  attemptsCount: number;
};

export default function ProfessorTurmaProvasPage() {
  const params = useParams();
  const classGroupId = params.id as string;
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<ExamRow[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/teacher/class-groups/${classGroupId}/exams`);
    const json = (await res.json()) as ApiResponse<{ exams: ExamRow[] }>;
    if (res.ok && json.ok) setExams(json.data.exams);
    else toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao carregar.");
  }, [classGroupId, toast]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function publish(examId: string) {
    const res = await fetch(`/api/teacher/class-groups/${classGroupId}/exams/${examId}/publish`, {
      method: "POST",
    });
    const json = (await res.json()) as ApiResponse<unknown>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao publicar.");
      return;
    }
    toast.push("success", "Prova publicada.");
    void load();
  }

  async function closeExam(examId: string) {
    const res = await fetch(`/api/teacher/class-groups/${classGroupId}/exams/${examId}/close`, {
      method: "POST",
    });
    const json = (await res.json()) as ApiResponse<unknown>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao encerrar.");
      return;
    }
    toast.push("success", "Prova encerrada.");
    void load();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={`/professor/turmas/${classGroupId}`} className="text-sm text-[var(--igh-primary)] hover:underline">
            ← Voltar à turma
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">Provas</h1>
        </div>
        <Link href={`/professor/turmas/${classGroupId}/provas/nova`}>
          <Button>Nova prova</Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : exams.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Nenhuma prova cadastrada.</p>
      ) : (
        <ul className="space-y-3">
          {exams.map((e) => (
            <li
              key={e.id}
              className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{e.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {e.questionCount} questões · {e.durationMinutes} min ·{" "}
                    {e.timingMode === "FROM_EXAM_START" ? "tempo desde o início da prova" : "tempo desde o clique do aluno"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Disponível: {new Date(e.availableFrom).toLocaleString("pt-BR")} —{" "}
                    {new Date(e.availableUntil).toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{e.attemptsCount} tentativa(s)</p>
                </div>
                <Badge tone={e.status === "PUBLISHED" ? "green" : e.status === "DRAFT" ? "zinc" : "amber"}>
                  {e.status === "PUBLISHED" ? "Publicada" : e.status === "DRAFT" ? "Rascunho" : "Encerrada"}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/professor/turmas/${classGroupId}/provas/${e.id}`}>
                  <Button variant="secondary">Editar / resultados</Button>
                </Link>
                {e.status === "DRAFT" && (
                  <Button variant="secondary" onClick={() => void publish(e.id)}>
                    Publicar
                  </Button>
                )}
                {e.status === "PUBLISHED" && (
                  <Button variant="secondary" className="text-red-600" onClick={() => void closeExam(e.id)}>
                    Encerrar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
