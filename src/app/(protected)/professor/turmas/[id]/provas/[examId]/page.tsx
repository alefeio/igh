"use client";

import { useParams } from "next/navigation";
import { ProfessorExamEditor } from "@/components/professor/ProfessorExamEditor";
import { ProfessorExamReview } from "@/components/professor/ProfessorExamReview";

export default function EditarProvaPage() {
  const params = useParams();
  const classGroupId = params.id as string;
  const examId = params.examId as string;

  return (
    <div className="container-page flex flex-col gap-8 py-4">
      <ProfessorExamEditor classGroupId={classGroupId} examId={examId} />
      <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Gabarito e correção</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Consulte o gabarito (provas manuais) e cada prova enviada pelos alunos, com acertos e erros destacados.
        </p>
        <div className="mt-6">
          <ProfessorExamReview classGroupId={classGroupId} examId={examId} />
        </div>
      </section>
    </div>
  );
}
