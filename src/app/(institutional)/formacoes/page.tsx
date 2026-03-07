import { PageHeader, Section, FormacoesSection, Card, Button } from "@/components/site";
import {
  getFormationsForFilter,
  getCoursesForSite,
  getComoFuncionaFormacao,
  getFormacoesPageForSite,
} from "@/lib/site-data";

export const metadata = {
  title: "Formações | IGH",
  description: "Trilhas em Programação, Dados, UX/UI, Marketing. Pré-requisito: Informática Básica.",
};

type Props = { searchParams: Promise<{ formacao?: string }> };

export default async function FormacoesPage({ searchParams }: Props) {
  const { formacao: formacaoSlug } = await searchParams;

  const [formations, courses, comoFunciona, formacoesPage] = await Promise.all([
    getFormationsForFilter(),
    getCoursesForSite(formacaoSlug),
    Promise.resolve(getComoFuncionaFormacao()),
    getFormacoesPageForSite(),
  ]);

  const headerTitle = formacoesPage?.title?.trim() || "Formações e Cursos";
  const headerSubtitle = formacoesPage?.subtitle?.trim() || "Pré-requisito: Informática Básica.";
  const headerImageUrl = formacoesPage?.headerImageUrl?.trim() || null;

  return (
    <>
      <PageHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        backgroundImageUrl={headerImageUrl}
      />

      <Section title="Formações">
        <FormacoesSection
          formations={formations}
          courses={courses}
          formacaoSlug={formacaoSlug}
        />
      </Section>

      <Section title="Como funciona a formação" background="muted">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {comoFunciona.map((etapa, i) => (
            <Card key={i} as="article">
              <h4 className="font-semibold text-[var(--igh-secondary)]">{etapa.titulo}</h4>
              <p className="mt-2 text-sm text-[var(--igh-muted)]">{etapa.descricao}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <Button as="link" href="/inscreva" variant="primary" size="lg">
            Quero me inscrever
          </Button>
        </div>
      </Section>
    </>
  );
}
