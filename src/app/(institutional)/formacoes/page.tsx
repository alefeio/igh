import { PageHeader, Section, Button, Card } from "@/components/site";
import { getFormationsWithCourses, getComoFuncionaFormacao } from "@/lib/site-data";

export const metadata = {
  title: "Formações | IGH",
  description: "Trilhas em Programação, Dados, UX/UI, Marketing. Pré-requisito: Informática Básica.",
};

export default async function FormacoesPage() {
  const [formations, comoFunciona] = await Promise.all([
    getFormationsWithCourses(),
    Promise.resolve(getComoFuncionaFormacao()),
  ]);

  return (
    <>
      <PageHeader title="Formações e Cursos" subtitle="Pré-requisito: Informática Básica." />
      <Section title="Formações por afinidade">
        {formations.length === 0 ? (
          <p className="text-center text-[var(--igh-muted)]">Nenhuma formação cadastrada no momento.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {formations.map((f) => (
              <Card key={f.id} as="article" className="flex flex-col">
                <h3 className="text-lg font-semibold text-[var(--igh-secondary)]">{f.title}</h3>
                <p className="mt-2 text-sm text-[var(--igh-muted)]">{f.audience ?? f.summary ?? ""}</p>
                {f.outcomes.length > 0 && (
                  <ul className="mt-3 list-inside list-disc text-sm text-[var(--igh-muted)]">
                    {f.outcomes.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
                {f.finalProject && (
                  <p className="mt-3 text-sm font-medium text-[var(--igh-secondary)]">Entrega: {f.finalProject}</p>
                )}
                <Button as="link" href="/contato" variant="primary" size="sm" className="mt-4 w-full">
                  Quero me inscrever
                </Button>
              </Card>
            ))}
          </div>
        )}
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
