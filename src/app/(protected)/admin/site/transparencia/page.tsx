"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import type { ApiResponse } from "@/lib/api-types";

type Category = {
  id: string;
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
  _count?: { documents: number };
};

type Document = {
  id: string;
  title: string;
  categoryId: string;
  date: string | null;
  fileUrl: string | null;
  isActive: boolean;
  category: { name: string };
};

export default function TransparenciaPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [catRes, docRes] = await Promise.all([
        fetch("/api/admin/site/transparency/categories"),
        fetch("/api/admin/site/transparency/documents"),
      ]);
      const catJson = (await catRes.json()) as ApiResponse<{ items: Category[] }>;
      const docJson = (await docRes.json()) as ApiResponse<{ items: Document[] }>;
      if (!catRes.ok || !catJson.ok) {
        toast.push("error", !catJson.ok ? catJson.error.message : "Falha ao carregar categorias.");
        return;
      }
      if (!docRes.ok || !docJson.ok) {
        toast.push("error", !docJson.ok ? docJson.error.message : "Falha ao carregar documentos.");
        return;
      }
      setCategories(catJson.data.items);
      setDocuments(docJson.data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-lg font-semibold">Transparência</div>
        <div className="text-sm text-zinc-600">Categorias e documentos para download. Gerencie em API /api/admin/site/transparency/categories e /api/admin/site/transparency/documents.</div>
      </div>
      {loading ? (
        <div className="text-sm text-zinc-600">Carregando...</div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-zinc-700">Categorias ({categories.length})</h3>
            <ul className="mt-2 space-y-1">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-sm text-zinc-500">/{c.slug}</span>
                  {c.isActive ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}
                </li>
              ))}
              {categories.length === 0 && <p className="text-zinc-600">Nenhuma categoria.</p>}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-700">Documentos ({documents.length})</h3>
            <ul className="mt-2 space-y-1">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-sm">
                  <span>{d.title}</span>
                  <span className="text-zinc-500">({d.category.name})</span>
                  {d.isActive ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}
                </li>
              ))}
              {documents.length === 0 && <p className="text-zinc-600">Nenhum documento.</p>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
