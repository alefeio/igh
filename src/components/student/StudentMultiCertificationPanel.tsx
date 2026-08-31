import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";

import { SectionCard } from "@/components/dashboard/DashboardUI";
import { MultiCertifiedShowcase } from "@/components/site/MultiCertifiedShowcase";
import type {
  MultiCertifiedShowcasePayload,
  StudentMultiCertProgress,
} from "@/lib/student-multi-certification-shared";

function progressMessage(progress: StudentMultiCertProgress): { title: string; body: string } {
  if (progress.certificationCount === 0) {
    return {
      title: "Comece sua trilha de certificações",
      body: "Conclua seu primeiro curso para dar o primeiro passo rumo ao Mural de Multicertificados.",
    };
  }
  if (progress.certificationCount === 1) {
    return {
      title: "Falta 1 curso para o Mural",
      body: "Você já tem 1 certificação. Mais um curso concluído e seu nome entra no Mural de Multicertificados.",
    };
  }
  if (progress.tier === "platinum") {
    return {
      title: "Você está no topo do Mural",
      body: `Parabéns, ${progress.displayName.split(" ")[0]}! Você acumulou ${progress.certificationCount} certificações — referência em qualificação contínua.`,
    };
  }
  if (progress.coursesNeededForNextTier === 1) {
    return {
      title: "Você está no Mural",
      body: `Você tem ${progress.certificationCount} certificações. Falta 1 curso para subir de destaque no mural.`,
    };
  }
  return {
    title: "Você está no Mural",
    body: `Você tem ${progress.certificationCount} certificações. Continue formando-se para ganhar mais destaque.`,
  };
}

export function StudentMultiCertificationPanel({
  progress,
  showcase,
  highlightStudentId,
}: {
  progress: StudentMultiCertProgress;
  showcase: MultiCertifiedShowcasePayload | null;
  highlightStudentId?: string | null;
}) {
  const copy = progressMessage(progress);
  const showMural = showcase != null && showcase.entries.length > 0;

  return (
    <SectionCard
      title="Qualificação contínua"
      description="Alunos com 2 ou mais certificações entram no mural institucional."
      variant="elevated"
    >
      <div className="rounded-2xl border border-[var(--igh-primary)]/25 bg-gradient-to-br from-[var(--igh-primary)]/8 via-[var(--card-bg)] to-violet-500/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--igh-primary)]/15 text-[var(--igh-primary)]">
            <GraduationCap className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--igh-primary)]">
              {progress.isOnMural ? "No mural" : "Seu progresso"}
            </p>
            <h3 className="mt-1 text-lg font-bold text-[var(--text-primary)]">{copy.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{copy.body}</p>
            <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
              {progress.certificationCount}{" "}
              {progress.certificationCount === 1 ? "certificação concluída" : "certificações concluídas"}
            </p>
          </div>
        </div>
        {!progress.isOnMural || progress.coursesNeededForNextTier != null ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--card-border)] pt-4">
            <Link
              href="/formacoes"
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
            >
              Ver formações
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/inscreva"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--igh-primary)]/40"
            >
              Inscrever-se em turma
            </Link>
          </div>
        ) : null}
      </div>

      {showMural ? (
        <div className="mt-6">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Mural de multicertificados
          </h4>
          <MultiCertifiedShowcase
            data={showcase}
            variant="compact"
            highlightStudentId={highlightStudentId}
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
