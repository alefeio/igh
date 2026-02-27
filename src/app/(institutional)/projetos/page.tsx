import Link from "next/link";
import { PageHeader, Section, Card, Button } from "@/components/site";
import { projetosList } from "@/content";

export const metadata = {
  title: "Projetos | Instituto Gustavo Hessel",
  description: "Conheça os projetos do IGH: CRC, Computadores para Inclusão, Doações e Entregas.",
  openGraph: { title: "Projetos | IGH", description: "CRC, Computadores para Inclusão, Doações e Entregas." },
};

export default function ProjetosPage() {
  return (
    <>
      <PageHeader
        title="Projetos"
        subtitle="Inclusão digital, recondicionamento de equipamentos e sustentabilidade."
      />
      <Section>
        <div className="grid gap-6 sm:grid-cols-2">
          {projetosList.map((p) => (
            <Card key={p.slug} as="article" className="flex flex-col">
              <h2 className="text-xl font-semibold text-[var(--igh-secondary)]">{p.title}</h2>
              <p className="mt-2 text-[var(--igh-muted)]">{p.shortDescription}</p>
              <ul className="mt-3 list-inside list-disc text-sm text-[var(--igh-muted)]">
                {p.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
              <Button as="link" href={`/projetos/${p.slug}`} variant="primary" size="sm" className="mt-4 w-full sm:w-auto">
                Saiba mais
              </Button>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
