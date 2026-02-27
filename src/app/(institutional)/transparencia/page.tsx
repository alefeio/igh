import { PageHeader, Section, Card } from "@/components/site";
import { documentos, categoriasTransparencia } from "@/content";

export const metadata = {
  title: "Transparência | IGH",
  description: "Editais, convênios e relatórios do IGH.",
};

export default function TransparenciaPage() {
  const byCategory = categoriasTransparencia.map((cat) => ({
    categoria: cat,
    items: documentos.filter((d) => d.categoria === cat),
  }));

  return (
    <>
      <PageHeader title="Transparência" subtitle="Prestação de contas: editais, convênios e relatórios." />
      <Section>
        {byCategory.map(({ categoria, items }) => (
          <div key={categoria} className="mb-12">
            <h2 className="text-xl font-semibold text-[var(--igh-secondary)] mb-4">{categoria}</h2>
            <div className="space-y-4">
              {items.map((doc) => (
                <Card key={doc.id} as="article" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-[var(--igh-secondary)]">{doc.titulo}</h3>
                    <p className="mt-1 text-sm text-[var(--igh-muted)]">{doc.data}</p>
                    <p className="mt-2 text-sm text-[var(--igh-muted)]">{doc.descricao}</p>
                  </div>
                  <a href={doc.arquivo} download className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--igh-primary-hover)]">Baixar PDF</a>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}
