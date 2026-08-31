import type { MultiCertifiedShowcasePayload } from "@/lib/student-multi-certification-shared";

import { Container } from "./Container";
import { MultiCertifiedGrid } from "./MultiCertifiedGrid";
import { Section } from "./Section";

export function MultiCertifiedShowcase({
  data,
  variant = "public",
  highlightStudentId,
  title,
  subtitle,
}: {
  data: MultiCertifiedShowcasePayload;
  variant?: "public" | "compact";
  highlightStudentId?: string | null;
  title?: string;
  subtitle?: string;
}) {
  if (data.entries.length === 0) return null;

  const isCompact = variant === "compact";
  const sectionTitle = title ?? "Qualificação contínua";
  const sectionSubtitle =
    subtitle ??
    "Alunos que concluíram 2 ou mais cursos — quanto mais certificações, maior o destaque.";

  const grid = (
    <MultiCertifiedGrid
      entries={data.entries}
      highlightStudentId={highlightStudentId}
      compact={isCompact}
    />
  );

  if (isCompact) {
    return (
      <div className="space-y-3">
        {grid}
        {data.hiddenCount > 0 ? (
          <p className="text-center text-xs text-[var(--text-muted)]">
            e mais {data.hiddenCount} {data.hiddenCount === 1 ? "aluno" : "alunos"} no mural
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Section title={sectionTitle} subtitle={sectionSubtitle} background="muted" headerClassName="text-center">
      <Container>
        {grid}
        {data.hiddenCount > 0 ? (
          <p className="mt-6 text-center text-sm text-[var(--igh-muted)]">
            e mais {data.hiddenCount} {data.hiddenCount === 1 ? "aluno" : "alunos"} com 2 ou mais certificações
          </p>
        ) : null}
      </Container>
    </Section>
  );
}
