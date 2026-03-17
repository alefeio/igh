import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, ImageCarousel } from "@/components/site";
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
    ? (() => {
        const d = post.publishedAt!;
        const cal = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        return cal.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      })()
    : "";

  const carouselImages = [
    ...(post.coverImageUrl ? [post.coverImageUrl] : []),
    ...(post.imageUrls ?? []),
  ].filter(Boolean);

  return (
    <article className="py-12">
      <Container>
        <div className="mx-auto max-w-2xl">
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
          {carouselImages.length > 0 && (
            <ImageCarousel images={carouselImages} className="mt-4" />
          )}
          <div className="mt-6 w-full text-[var(--igh-muted)]">
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
        </div>
      </Container>
    </article>
  );
}
