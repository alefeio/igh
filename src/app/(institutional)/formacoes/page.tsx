import { PageHeader, Section, FormacoesSection, Card } from "@/components/site";
import {
  getFormationsForFilter,
  getCoursesForSite,
  getCourseBySlug,
  getComoFuncionaFormacao,
} from "@/lib/site-data";

export const metadata = {
  title: "Formações | IGH",
  description: "Trilhas em Programação, Dados, UX/UI, Marketing. Pré-requisito: Informática Básica.",
};

type Props = { searchParams: Promise<{ formacao?: string; curso?: string }> };

export default async function FormacoesPage({ searchParams }: Props) {
  const { formacao: formacaoSlug, curso: cursoSlug } = await searchParams;

  const [formations, courses, courseDetail, comoFunciona] = await Promise.all([
    getFormationsForFilter(),
    getCoursesForSite(formacaoSlug),
    cursoSlug ? getCourseBySlug(cursoSlug) : Promise.resolve(null),
    Promise.resolve(getComoFuncionaFormacao()),
  ]);

  return (
    <>
      <PageHeader title="Formações e Cursos" subtitle="Pré-requisito: Informática Básica." />

      <Section title="Formações">
        <FormacoesSection
          formations={formations}
          courses={courses}
          formacaoSlug={formacaoSlug}
          courseDetail={courseDetail}
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
      </Section>
    </>
  );
}
