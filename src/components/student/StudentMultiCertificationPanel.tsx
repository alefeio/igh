import Link from "next/link";

import { SectionCard } from "@/components/dashboard/DashboardUI";
import { MultiCertifiedGrid } from "@/components/site/MultiCertifiedGrid";
import { MULTI_CERT_FULL_LIST_PATH } from "@/lib/student-multi-certification-routes";
import type {
  MultiCertifiedShowcasePayload,
  StudentMultiCertProgress,
} from "@/lib/student-multi-certification-shared";

export function StudentMultiCertificationPanel({
  progress,
  showcase,
  highlightStudentId,
  title = "Qualificação contínua",
  description = "Alunos em destaque com 3 ou mais certificações concluídas no instituto.",
  fullListHref = MULTI_CERT_FULL_LIST_PATH,
  showPersonalHint = true,
}: {
  progress: StudentMultiCertProgress | null;
  showcase: MultiCertifiedShowcasePayload | null;
  highlightStudentId?: string | null;
  title?: string;
  description?: string;
  fullListHref?: string | null;
  showPersonalHint?: boolean;
}) {
  if (!showcase || showcase.entries.length === 0) return null;

  const personalHint =
    showPersonalHint && progress && !progress.isOnFeaturedShowcase ? (
      <p className="rounded-xl border border-dashed border-[var(--igh-primary)]/30 bg-[var(--igh-primary)]/5 px-4 py-3 text-sm text-[var(--text-primary)]">
        {progress.certificationCount === 0 ? (
          <>
            Você ainda não aparece em destaque. Conclua{" "}
            <strong>{progress.coursesNeededForFeatured} cursos</strong> para entrar na vitrine.{" "}
            <Link href="/formacoes" className="font-semibold text-[var(--igh-primary)] underline">
              Ver formações
            </Link>
          </>
        ) : progress.isOnMural ? (
          <>
            Você está no{" "}
            {fullListHref ? (
              <Link href={fullListHref} className="font-semibold text-[var(--igh-primary)] underline">
                mural completo
              </Link>
            ) : (
              "mural completo"
            )}{" "}
            com <strong>{progress.certificationCount}</strong>{" "}
            {progress.certificationCount === 1 ? "certificação" : "certificações"}. Falta{" "}
            <strong>{progress.coursesNeededForFeatured}</strong> para aparecer em destaque aqui.{" "}
            <Link href="/inscreva" className="font-semibold text-[var(--igh-primary)] underline">
              Inscrever-se em turma
            </Link>
          </>
        ) : (
          <>
            Você tem <strong>{progress.certificationCount}</strong>{" "}
            {progress.certificationCount === 1 ? "certificação" : "certificações"}. Falta{" "}
            <strong>{progress.coursesNeededForMural}</strong> para o mural completo e{" "}
            <strong>{progress.coursesNeededForFeatured}</strong> para o destaque.{" "}
            <Link href="/inscreva" className="font-semibold text-[var(--igh-primary)] underline">
              Inscrever-se em turma
            </Link>
          </>
        )}
      </p>
    ) : showPersonalHint && progress?.isOnFeaturedShowcase && progress.coursesNeededForNextTier === 1 ? (
      <p className="text-center text-sm text-[var(--text-muted)]">
        Você está em destaque com {progress.certificationCount} certificações. Falta{" "}
        <strong className="text-[var(--text-primary)]">1 curso</strong> para subir de faixa.
      </p>
    ) : null;

  return (
    <SectionCard title={title} description={description} variant="elevated">
      <MultiCertifiedGrid
        entries={showcase.entries}
        highlightStudentId={highlightStudentId}
        compact
      />
      {showcase.hiddenCount > 0 ? (
        <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
          e mais {showcase.hiddenCount} {showcase.hiddenCount === 1 ? "aluno" : "alunos"} em destaque
        </p>
      ) : null}
      {fullListHref ? (
        <div className="mt-4 text-center">
          <Link
            href={fullListHref}
            className="inline-flex items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:opacity-90"
          >
            Ver mural completo (2 ou mais certificações)
          </Link>
        </div>
      ) : null}
      {personalHint ? <div className="mt-4">{personalHint}</div> : null}
    </SectionCard>
  );
}
