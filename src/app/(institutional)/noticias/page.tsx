"use client";

import { useState, useMemo } from "react";
import { PageHeader, Section, BlogCard, Button } from "@/components/site";
import { posts, postCategories } from "@/content";

const PAGE_SIZE = 6;

export default function NoticiasPage() {
  const [filter, setFilter] = useState<string>("Todas");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (filter === "Todas") return [...posts];
    return posts.filter((p) => p.category === filter);
  }, [filter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  return (
    <>
      <PageHeader title="Notícias" subtitle="Acompanhe as novidades do IGH." />
      <Section>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setFilter("Todas"); setPage(1); }}
            className={`rounded-full px-4 py-2 text-sm font-medium ${filter === "Todas" ? "bg-[var(--igh-primary)] text-white" : "bg-[var(--igh-surface)] text-[var(--igh-muted)]"}`}
          >
            Todas
          </button>
          {postCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => { setFilter(cat); setPage(1); }}
              className={`rounded-full px-4 py-2 text-sm font-medium ${filter === cat ? "bg-[var(--igh-primary)] text-white" : "bg-[var(--igh-surface)] text-[var(--igh-muted)]"}`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {paginated.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Anterior
            </Button>
            <span className="text-sm text-[var(--igh-muted)]">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Próxima
            </Button>
          </div>
        )}
      </Section>
    </>
  );
}
