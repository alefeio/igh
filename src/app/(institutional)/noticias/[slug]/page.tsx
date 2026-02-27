import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/site";
import { getPostBySlug, getAllSlugs } from "@/content";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Notícia | IGH" };
  return { title: `${post.title} | IGH`, description: post.excerpt };
}

export default async function NoticiaSlugPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();
  const dateFormatted = new Date(post.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <article className="py-12">
      <Container>
        <Link href="/noticias" className="text-sm font-medium text-[var(--igh-primary)] hover:underline">Voltar às notícias</Link>
        <header className="mt-4">
          <span className="text-sm text-[var(--igh-muted)]">{post.category} - {dateFormatted}</span>
          <h1 className="mt-2 text-3xl font-bold text-[var(--igh-secondary)]">{post.title}</h1>
        </header>
        <div className="mt-6 max-w-2xl text-[var(--igh-muted)]">
          <p className="text-lg">{post.excerpt}</p>
          <p className="mt-4">Conteúdo estático. Substitua por conteúdo real quando houver CMS ou API.</p>
        </div>
      </Container>
    </article>
  );
}
