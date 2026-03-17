import { PageHeader, Section, Card } from "@/components/site";
import { cloudinaryRawUrlForDownload } from "@/lib/cloudinary-url";
import { getTransparencyForSite } from "@/lib/site-data";

export const metadata = {
  title: "Transparência | IGH",
  description: "Editais, convênios e relatórios do IGH.",
};

function formatDate(d: Date | null): string {
  if (!d) return "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const cal = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const month = cal.toLocaleDateString("pt-BR", { month: "long" });
  const year = d.getUTCFullYear();
  return `${day} de ${month} de ${year}`;
}

export default async function TransparenciaPage() {
  const categories = await getTransparencyForSite();

  return (
    <>
      <PageHeader title="Transparência" subtitle="Prestação de contas: editais, convênios e relatórios." />
      <Section>
        {categories.length === 0 ? (
          <p className="text-center text-[var(--igh-muted)]">Nenhum documento cadastrado no momento.</p>
        ) : (
          categories.map((cat) => (
            <div key={cat.id} className="mb-12">
              <h2 className="mb-4 text-xl font-semibold text-[var(--igh-secondary)]">{cat.name}</h2>
              <div className="space-y-4">
                {cat.documents.length === 0 ? (
                  <p className="text-sm text-[var(--igh-muted)]">Nenhum documento nesta categoria.</p>
                ) : (
                  cat.documents.map((doc) => (
                    <Card key={doc.id} as="article" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-medium text-[var(--igh-secondary)]">{doc.title}</h3>
                        {doc.date && (
                          <p className="mt-1 text-sm text-[var(--igh-muted)]">{formatDate(doc.date)}</p>
                        )}
                        {doc.description && (
                          <p className="mt-2 text-sm text-[var(--igh-muted)]">{doc.description}</p>
                        )}
                      </div>
                      {doc.fileUrl && (
                        <a
                          href={cloudinaryRawUrlForDownload(doc.fileUrl)}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg bg-[var(--igh-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--igh-primary-hover)]"
                        >
                          Baixar PDF
                        </a>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </Section>
    </>
  );
}
