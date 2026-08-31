import type { Metadata } from "next";

import { MultiCertifiedGrid } from "@/components/site/MultiCertifiedGrid";
import { Container } from "@/components/site/Container";
import { Section } from "@/components/site/Section";
import { BRAND } from "@/lib/brand";
import { getFullMultiCertifiedShowcase } from "@/lib/student-multi-certification";

export const metadata: Metadata = {
  title: `Qualificação contínua | ${BRAND.shortName}`,
  description: `Mural de alunos do ${BRAND.shortName} com 2 ou mais certificações concluídas.`,
};

export default async function QualificacaoContinuaPage() {
  const showcase = await getFullMultiCertifiedShowcase();

  return (
    <Section
      title="Qualificação contínua"
      subtitle="Todos os alunos com 2 ou mais certificações concluídas no instituto. Na home e nos painéis, o destaque principal exibe quem já alcançou 3 ou mais troféus."
      background="muted"
      headerClassName="text-center"
    >
      <Container>
        {showcase && showcase.entries.length > 0 ? (
          <>
            <p className="mb-6 text-center text-sm text-[var(--igh-muted)]">
              {showcase.totalEligible}{" "}
              {showcase.totalEligible === 1 ? "aluno neste mural" : "alunos neste mural"}
            </p>
            <MultiCertifiedGrid entries={showcase.entries} />
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--igh-border)] bg-[var(--card-bg)] px-6 py-12 text-center text-sm text-[var(--igh-muted)]">
            Ainda não há alunos com 2 ou mais certificações. Em breve este mural será atualizado.
          </p>
        )}
      </Container>
    </Section>
  );
}
