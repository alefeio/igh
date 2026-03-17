import { PageHeader, NoticiasList } from "@/components/site";
import type { PostForCard } from "@/components/site/NoticiasList";
import { getNewsCategoriesForSite, getNewsPostsForSite } from "@/lib/site-data";

export const metadata = {
  title: "Notícias | Instituto Gustavo Hessel",
  description: "Acompanhe as novidades do IGH.",
  openGraph: { title: "Notícias | IGH", description: "Acompanhe as novidades do IGH." },
};

function toPostForCard(p: {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  categoryName: string | null;
  publishedAt: Date | null;
}): PostForCard {
  let date = "";
  if (p.publishedAt) {
    const d = p.publishedAt;
    date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt ?? "",
    category: p.categoryName ?? "Sem categoria",
    date,
    image: p.coverImageUrl ?? undefined,
  };
}

export default async function NoticiasPage() {
  const [categories, posts] = await Promise.all([
    getNewsCategoriesForSite(),
    getNewsPostsForSite(),
  ]);
  const postsForCard: PostForCard[] = posts.map(toPostForCard);

  return (
    <>
      <PageHeader title="Notícias" subtitle="Acompanhe as novidades do IGH." />
      <NoticiasList posts={postsForCard} categories={categories} />
    </>
  );
}
