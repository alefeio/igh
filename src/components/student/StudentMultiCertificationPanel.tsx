import Link from "next/link";

import { SectionCard } from "@/components/dashboard/DashboardUI";
import { MultiCertifiedGrid } from "@/components/site/MultiCertifiedGrid";
import type {
  MultiCertifiedShowcasePayload,
  StudentMultiCertProgress,
} from "@/lib/student-multi-certification-shared";

export function StudentMultiCertificationPanel({
  progress,
  showcase,
  highlightStudentId,
}: {
  progress: StudentMultiCertProgress | null;
  showcase: MultiCertifiedShowcasePayload | null;
  highlightStudentId?: string | null;
}) {
  if (!showcase || showcase.entries.length === 0) return null;

  const personalHint =
    progress && !progress.isOnMural ? (
      <p className="rounded-xl border border-dashed border-[var(--igh-primary)]/30 bg-[var(--igh-primary)]/5 px-4 py-3 text-sm text-[var(--text-primary)]">
        {progress.certificationCount === 0 ? (
          <>
            Você ainda não aparece aqui. Conclua{" "}
            <strong>{progress.coursesNeededForMural} cursos</strong> para entrar no mural.{" "}
            <Link href="/formacoes" className="font-semibold text-[var(--igh-primary)] underline">
              Ver formações
            </Link>
          </>
        ) : (
          <>
            Você tem <strong>{progress.certificationCount}</strong>{" "}
            {progress.certificationCount === 1 ? "certificação" : "certificações"}. Falta{" "}
            <strong>{progress.coursesNeededForMural}</strong> para entrar no mural.{" "}
            <Link href="/inscreva" className="font-semibold text-[var(--igh-primary)] underline">
              Inscrever-se em turma
            </Link>
          </>
        )}
      </p>
    ) : progress?.isOnMural && progress.coursesNeededForNextTier === 1 ? (
      <p className="text-center text-sm text-[var(--text-muted)]">
        Você está no mural com {progress.certificationCount} certificações. Falta{" "}
        <strong className="text-[var(--text-primary)]">1 curso</strong> para subir de destaque.
      </p>
    ) : null;

  return (
    <SectionCard
      title="Qualificação contínua"
      description="Alunos com 2 ou mais certificações concluídas no instituto."
      variant="elevated"
    >
      <MultiCertifiedGrid
        entries={showcase.entries}
        highlightStudentId={highlightStudentId}
        compact
      />
      {showcase.hiddenCount > 0 ? (
        <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
          e mais {showcase.hiddenCount} {showcase.hiddenCount === 1 ? "aluno" : "alunos"} no mural
        </p>
      ) : null}
      {personalHint ? <div className="mt-4">{personalHint}</div> : null}
    </SectionCard>
  );
}
