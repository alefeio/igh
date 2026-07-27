import { PageHeader, NoticiasList } from "@/components/site";
import type { PostForCard } from "@/components/site/NoticiasList";
import { BRAND, pageTitle, pageTitleLegal } from "@/lib/brand";
import { getNewsCategoriesForSite, getNewsPostsForSite } from "@/lib/site-data";

const newsSubtitle = `Acompanhe as novidades do ${BRAND.shortName}.`;

export const metadata = {
  title: pageTitleLegal("Notícias"),
  description: newsSubtitle,
  openGraph: { title: pageTitle("Notícias"), description: newsSubtitle },
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
      <PageHeader title="Notícias" subtitle={newsSubtitle} />
      <NoticiasList posts={postsForCard} categories={categories} />
    </>
  );
}
