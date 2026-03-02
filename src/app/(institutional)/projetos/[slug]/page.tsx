import { notFound } from "next/navigation";
import { PageHeader, Section, Button } from "@/components/site";
import { getProjectBySlug, getProjectsForSite } from "@/lib/site-data";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const projects = await getProjectsForSite();
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const p = await getProjectBySlug(slug);
  if (!p) return { title: "Projeto | IGH" };
  return {
    title: `${p.title} | Instituto Gustavo Hessel`,
    description: p.summary ?? undefined,
    openGraph: { title: `${p.title} | IGH`, description: p.summary ?? undefined },
  };
}

export default async function ProjetoSlugPage({ params }: Props) {
  const { slug } = await params;
  const projeto = await getProjectBySlug(slug);
  if (!projeto) notFound();

  return (
    <>
      <PageHeader title={projeto.title} subtitle={projeto.summary ?? undefined} />
      <Section>
        {projeto.coverImageUrl && (
          <img src={projeto.coverImageUrl} alt="" className="mb-6 h-64 w-full rounded-lg object-cover" />
        )}
        {projeto.content ? (
          <div
            className="prose prose-lg max-w-none text-[var(--igh-muted)]"
            dangerouslySetInnerHTML={{ __html: projeto.content }}
          />
        ) : (
          <p className="max-w-2xl text-[var(--igh-muted)]">{projeto.summary ?? "Conteúdo em breve."}</p>
        )}
        <div className="mt-8 flex flex-wrap gap-4">
          <Button as="link" href="/projetos" variant="outline">
            Voltar aos projetos
          </Button>
          <Button as="link" href="/contato" variant="primary">
            Entrar em contato
          </Button>
        </div>
      </Section>
    </>
  );
}
