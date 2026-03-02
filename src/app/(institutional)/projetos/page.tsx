import { PageHeader, Section, Card, Button } from "@/components/site";
import { getProjectsForSite } from "@/lib/site-data";

export const metadata = {
  title: "Projetos | Instituto Gustavo Hessel",
  description: "Conheça os projetos do IGH: CRC, Computadores para Inclusão, Doações e Entregas.",
  openGraph: { title: "Projetos | IGH", description: "CRC, Computadores para Inclusão, Doações e Entregas." },
};

export default async function ProjetosPage() {
  const projects = await getProjectsForSite();

  return (
    <>
      <PageHeader
        title="Projetos"
        subtitle="Inclusão digital, recondicionamento de equipamentos e sustentabilidade."
      />
      <Section>
        {projects.length === 0 ? (
          <p className="text-center text-[var(--igh-muted)]">Nenhum projeto cadastrado no momento.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {projects.map((p) => (
              <Card key={p.id} as="article" className="flex flex-col">
                {p.coverImageUrl && (
                  <img src={p.coverImageUrl} alt="" className="mb-3 h-40 w-full rounded-lg object-cover" />
                )}
                <h2 className="text-xl font-semibold text-[var(--igh-secondary)]">{p.title}</h2>
                <p className="mt-2 text-[var(--igh-muted)]">{p.summary ?? "Sem resumo."}</p>
                <Button as="link" href={`/projetos/${p.slug}`} variant="primary" size="sm" className="mt-4 w-full sm:w-auto">
                  Saiba mais
                </Button>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
