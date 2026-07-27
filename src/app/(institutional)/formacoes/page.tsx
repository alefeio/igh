import {
  FAQ,
  PageHeader,
  Section,
  FormacoesSection,
  Card,
  Button,
  HomeObjectiveTrails,
  HomeHowItWorksSection,
} from "@/components/site";
import { pageTitle } from "@/lib/brand";
import {
  getFormationsForFilter,
  getCoursesForSite,
  getComoFuncionaFormacao,
  getFormacoesPageForSite,
  getFaqItems,
} from "@/lib/site-data";

export const metadata = {
  title: pageTitle("Formações"),
  description:
    "Catálogo de formações profissionais em tecnologia. Busque por tema, objetivo ou trilha. Pré-requisito: Informática Básica.",
};

type Props = {
  searchParams: Promise<{ formacao?: string; q?: string; objetivo?: string }>;
};

export default async function FormacoesPage({ searchParams }: Props) {
  const { formacao: formacaoSlug, q: searchQuery, objetivo } = await searchParams;

  const [formations, courses, comoFunciona, formacoesPage, faqFromDb] = await Promise.all([
    getFormationsForFilter(),
    getCoursesForSite(),
    Promise.resolve(getComoFuncionaFormacao()),
    getFormacoesPageForSite(),
    getFaqItems(),
  ]);

  const headerTitle = formacoesPage?.title?.trim() || "";
  const headerSubtitle = formacoesPage?.subtitle?.trim() || "";
  const headerImageUrl = formacoesPage?.headerImageUrl?.trim() || null;
  const faqItems = faqFromDb.map((i) => ({ pergunta: i.question, resposta: i.answer }));

  return (
    <>
      {(headerTitle || headerSubtitle || headerImageUrl) && (
        <PageHeader
          title={headerTitle}
          subtitle={headerSubtitle || undefined}
          backgroundImageUrl={headerImageUrl}
        />
      )}

      <HomeObjectiveTrails basePath="/formacoes" />

      <Section id="catalogo" title="Catálogo de cursos">
        <FormacoesSection
          formations={formations}
          courses={courses}
          formacaoSlug={formacaoSlug}
          initialQuery={searchQuery ?? ""}
          initialObjetivo={objetivo}
        />
      </Section>

      <HomeHowItWorksSection />

      {faqItems.length > 0 && <FAQ items={faqItems} title="Dúvidas sobre a matrícula" />}

      {comoFunciona.length > 0 && (
        <Section title="Estrutura da formação" background="muted">
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
      )}
    </>
  );
}
