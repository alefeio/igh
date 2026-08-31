import type { MultiCertifiedShowcasePayload } from "@/lib/student-multi-certification-shared";
import { MULTI_CERT_FULL_LIST_PATH } from "@/lib/student-multi-certification-routes";

import { Button } from "./Button";
import { Container } from "./Container";
import { MultiCertifiedGrid } from "./MultiCertifiedGrid";
import { Section } from "./Section";

export function MultiCertifiedShowcase({
  data,
  variant = "public",
  highlightStudentId,
  title,
  subtitle,
  fullListHref = MULTI_CERT_FULL_LIST_PATH,
}: {
  data: MultiCertifiedShowcasePayload;
  variant?: "public" | "compact";
  highlightStudentId?: string | null;
  title?: string;
  subtitle?: string;
  fullListHref?: string | null;
}) {
  if (data.entries.length === 0) return null;

  const isCompact = variant === "compact";
  const sectionTitle = title ?? "Qualificação contínua";
  const sectionSubtitle =
    subtitle ??
    "Alunos em destaque com 3 ou mais certificações concluídas no instituto.";

  const fullListLink =
    fullListHref != null ? (
      <div className={isCompact ? "mt-3 text-center" : "mt-8 text-center"}>
        <Button as="link" href={fullListHref} variant="outline" size={isCompact ? "sm" : "md"}>
          Ver mural completo (2 ou mais certificações)
        </Button>
      </div>
    ) : null;

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
            e mais {data.hiddenCount} {data.hiddenCount === 1 ? "aluno" : "alunos"} em destaque
          </p>
        ) : null}
        {fullListLink}
      </div>
    );
  }

  return (
    <Section title={sectionTitle} subtitle={sectionSubtitle} background="muted" headerClassName="text-center">
      <Container>
        {grid}
        {data.hiddenCount > 0 ? (
          <p className="mt-6 text-center text-sm text-[var(--igh-muted)]">
            e mais {data.hiddenCount} {data.hiddenCount === 1 ? "aluno" : "alunos"} com 3 ou mais certificações
          </p>
        ) : null}
        {fullListLink}
      </Container>
    </Section>
  );
}
