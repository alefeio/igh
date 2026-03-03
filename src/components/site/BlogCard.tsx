import Link from "next/link";
import { Card } from "./Card";
import { Badge } from "./Badge";

type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  image?: string;
};

export function BlogCard({ post }: { post: Post }) {
  const dateFormatted = new Date(post.date + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Card as="article" className="h-full flex flex-col overflow-hidden">
      <div className="aspect-video w-[calc(100%+3rem)] -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-xl bg-[var(--igh-surface)]">
        {post.image ? (
          <img src={post.image} alt="" className="block size-full object-cover" />
        ) : (
          <div className="size-full bg-[var(--igh-surface)]" aria-hidden />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone="primary">{post.category}</Badge>
        <time className="text-sm text-[var(--igh-muted)]" dateTime={post.date}>
          {dateFormatted}
        </time>
      </div>
      <h3 className="mt-2 text-lg font-semibold text-[var(--igh-secondary)]">
        <Link
          href={`/noticias/${post.slug}`}
          className="hover:text-[var(--igh-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] rounded"
        >
          {post.title}
        </Link>
      </h3>
      <p className="mt-2 flex-1 text-sm text-[var(--igh-muted)] line-clamp-3">{post.excerpt}</p>
      <Link
        href={`/noticias/${post.slug}`}
        className="mt-4 text-sm font-semibold text-[var(--igh-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] rounded"
      >
        Ler mais
      </Link>
    </Card>
  );
}
