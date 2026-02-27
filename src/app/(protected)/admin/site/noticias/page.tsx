"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import type { ApiResponse } from "@/lib/api-types";

type Post = { id: string; title: string; slug: string; isPublished: boolean; category: { name: string } | null };

export default function NoticiasPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Post[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/site/news/posts")
      .then((r) => r.json())
      .then((json: ApiResponse<{ items: Post[] }>) => {
        if (json.ok) setItems(json.data.items);
        else toast.push("error", json.error.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-lg font-semibold">Notícias</div>
      <div className="text-sm text-zinc-600">Posts do blog. API: /api/admin/site/news/categories e /api/admin/site/news/posts.</div>
      {loading ? <div className="text-sm text-zinc-600">Carregando...</div> : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded border bg-white p-3">
              <span className="font-medium">{p.title}</span>
              {p.isPublished ? <Badge tone="green">Publicado</Badge> : <Badge tone="amber">Rascunho</Badge>}
            </li>
          ))}
          {items.length === 0 && <p className="text-zinc-600">Nenhum post.</p>}
        </ul>
      )}
    </div>
  );
}
