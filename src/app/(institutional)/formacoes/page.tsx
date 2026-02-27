import { PageHeader, Section, Button, Card } from "@/components/site";
import { formaçõesPorAfinidade, comoFuncionaFormacao } from "@/content";

export const metadata = {
  title: "Formações | IGH",
  description: "Trilhas em Programação, Dados, UX/UI, Marketing. Pré-requisito: Informática Básica.",
};

export default function FormacoesPage() {
  return (
    <>
      <PageHeader title="Formações e Cursos" subtitle="Pré-requisito: Informática Básica." />
      <Section title="Formações por afinidade">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {formaçõesPorAfinidade.map((f) => (
            <Card key={f.id} as="article" className="flex flex-col">
              <h3 className="text-lg font-semibold text-[var(--igh-secondary)]">{f.name}</h3>
              <p className="mt-2 text-sm text-[var(--igh-muted)]">{f.paraQuem}</p>
              <ul className="mt-3 list-inside list-disc text-sm text-[var(--igh-muted)]">
                {f.oQueAprende.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm font-medium text-[var(--igh-secondary)]">Entrega: {f.entregaFinal}</p>
              <Button as="link" href="/contato" variant="primary" size="sm" className="mt-4 w-full">{f.cta}</Button>
            </Card>
          ))}
        </div>
      </Section>
      <Section title="Como funciona a formação" background="muted">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {comoFuncionaFormacao.map((etapa, i) => (
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
