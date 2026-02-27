import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader, Section, Button } from "@/components/site";
import { getProjetoBySlug } from "@/content";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const p = getProjetoBySlug(slug);
  if (!p) return { title: "Projeto | IGH" };
  return {
    title: `${p.title} | Instituto Gustavo Hessel`,
    description: p.shortDescription,
    openGraph: { title: `${p.title} | IGH`, description: p.shortDescription },
  };
}

export default async function ProjetoSlugPage({ params }: Props) {
  const { slug } = await params;
  const projeto = getProjetoBySlug(slug);
  if (!projeto) notFound();

  return (
    <>
      <PageHeader title={projeto.title} subtitle={projeto.shortDescription} />
      <Section>
        <p className="max-w-2xl text-[var(--igh-muted)]">{projeto.description}</p>
        <ul className="mt-6 list-inside list-disc text-[var(--igh-muted)]">
          {projeto.highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-4">
          <Button as="link" href="/projetos" variant="outline">
            Voltar aos projetos
          </Button>
          {projeto.slug === "doacoes-recebidas" && (
            <Button as="link" href="/contato" variant="primary">
              Entrar em contato
            </Button>
          )}
        </div>
      </Section>
    </>
  );
}
