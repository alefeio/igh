import { enrollmentFaqItems } from "@/content";
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
import {
  getFormationsForFilter,
  getCoursesForSite,
  getComoFuncionaFormacao,
  getFormacoesPageForSite,
} from "@/lib/site-data";

export const metadata = {
  title: "Formações | IGH",
  description:
    "Catálogo de formações profissionais em tecnologia. Busque por tema, objetivo ou trilha. Pré-requisito: Informática Básica.",
};

type Props = {
  searchParams: Promise<{ formacao?: string; q?: string; objetivo?: string }>;
};

export default async function FormacoesPage({ searchParams }: Props) {
  const { formacao: formacaoSlug, q: searchQuery, objetivo } = await searchParams;

  const [formations, courses, comoFunciona, formacoesPage] = await Promise.all([
    getFormationsForFilter(),
    getCoursesForSite(),
    Promise.resolve(getComoFuncionaFormacao()),
    getFormacoesPageForSite(),
  ]);

  const headerTitle = formacoesPage?.title?.trim() || "Formações e Cursos";
  const headerSubtitle =
    formacoesPage?.subtitle?.trim() ||
    "Catálogo amplo de formação profissional. Pré-requisito: Informática Básica.";
  const headerImageUrl = formacoesPage?.headerImageUrl?.trim() || null;

  return (
    <>
      <PageHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        backgroundImageUrl={headerImageUrl}
      />

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

      <FAQ items={enrollmentFaqItems} title="Dúvidas sobre a matrícula" />

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
    </>
  );
}
