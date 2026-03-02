import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/site";
import { getNewsPostBySlug, getNewsPostsForSite } from "@/lib/site-data";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const posts = await getNewsPostsForSite();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await getNewsPostBySlug(slug);
  if (!post) return { title: "Notícia | IGH" };
  return { title: `${post.title} | IGH`, description: post.excerpt ?? undefined };
}

export default async function NoticiaSlugPage({ params }: Props) {
  const { slug } = await params;
  const post = await getNewsPostBySlug(slug);
  if (!post) notFound();

  const dateFormatted = post.publishedAt
    ? post.publishedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "";

  return (
    <article className="py-12">
      <Container>
        <Link href="/noticias" className="text-sm font-medium text-[var(--igh-primary)] hover:underline">
          Voltar às notícias
        </Link>
        <header className="mt-4">
          <span className="text-sm text-[var(--igh-muted)]">
            {post.categoryName ?? "Notícia"}
            {dateFormatted ? ` - ${dateFormatted}` : ""}
          </span>
          <h1 className="mt-2 text-3xl font-bold text-[var(--igh-secondary)]">{post.title}</h1>
        </header>
        {post.coverImageUrl && (
          <img src={post.coverImageUrl} alt="" className="mt-4 h-64 w-full rounded-lg object-cover" />
        )}
        <div className="mt-6 max-w-2xl text-[var(--igh-muted)]">
          {post.excerpt && <p className="text-lg">{post.excerpt}</p>}
          {post.content ? (
            <div
              className="prose prose-lg mt-4 max-w-none"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          ) : (
            post.excerpt && <p className="mt-4">{post.excerpt}</p>
          )}
        </div>
      </Container>
    </article>
  );
}
