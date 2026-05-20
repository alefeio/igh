"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProfessorExamEditor } from "@/components/professor/ProfessorExamEditor";
import type { ApiResponse } from "@/lib/api-types";

type AttemptRow = {
  id: string;
  status: string;
  studentName: string;
  scorePercent: number | null;
  correctCount: number | null;
  totalQuestions: number | null;
  submittedAt: string | null;
};

export default function EditarProvaPage() {
  const params = useParams();
  const classGroupId = params.id as string;
  const examId = params.examId as string;
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);

  const loadAttempts = useCallback(async () => {
    const res = await fetch(`/api/teacher/class-groups/${classGroupId}/exams/${examId}`);
    const json = (await res.json()) as ApiResponse<{ exam: { attempts: AttemptRow[] } }>;
    if (res.ok && json.ok) setAttempts(json.data.exam.attempts ?? []);
  }, [classGroupId, examId]);

  useEffect(() => {
    void loadAttempts();
  }, [loadAttempts]);

  return (
    <div className="container-page flex flex-col gap-8 py-4">
      <ProfessorExamEditor classGroupId={classGroupId} examId={examId} />
      {attempts.length > 0 && (
        <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Resultados</h2>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[var(--text-muted)]">
                <th className="py-2">Aluno</th>
                <th className="py-2">Status</th>
                <th className="py-2">Nota</th>
                <th className="py-2">Enviado em</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-t border-[var(--card-border)]">
                  <td className="py-2">{a.studentName}</td>
                  <td className="py-2">{a.status}</td>
                  <td className="py-2">
                    {a.scorePercent != null ? `${a.scorePercent}% (${a.correctCount}/${a.totalQuestions})` : "—"}
                  </td>
                  <td className="py-2">
                    {a.submittedAt ? new Date(a.submittedAt).toLocaleString("pt-BR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
