"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CloudinaryImageUpload } from "@/components/admin/CloudinaryImageUpload";
import type { ApiErr, ApiResponse } from "@/lib/api-types";

type InscrevaPageItem = {
  id: string;
  title: string | null;
  subtitle: string | null;
  headerImageUrl: string | null;
};

export default function InscrevaPaginaPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site/inscreva-page");
      const json = (await res.json()) as ApiResponse<{ item: InscrevaPageItem | null }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao carregar.");
        return;
      }
      const item = json.data.item;
      if (item) {
        setTitle(item.title ?? "");
        setSubtitle(item.subtitle ?? "");
        setHeaderImageUrl(item.headerImageUrl ?? "");
      } else {
        setTitle("");
        setSubtitle("");
        setHeaderImageUrl("");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site/inscreva-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          subtitle: subtitle.trim() || null,
          headerImageUrl: headerImageUrl.trim() || null,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ item: InscrevaPageItem }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", "Conteúdo da página Inscreva-se atualizado.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-lg font-semibold">Inscreva-se (página)</div>
        <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-lg font-semibold">Inscreva-se (página)</div>
        <div className="text-sm text-[var(--text-secondary)]">
          Título, subtítulo e foto de fundo do cabeçalho da página /inscreva do site.
        </div>
      </div>
      <form className="flex flex-col gap-4" onSubmit={save}>
        <div>
          <label className="text-sm font-medium">Título</label>
          <Input
            className="mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Inscreva-se"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Subtítulo</label>
          <Input
            className="mt-1"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Ex: Faça sua pré-matrícula em uma das turmas disponíveis..."
          />
        </div>
        <div>
          <label className="text-sm font-medium">Foto de fundo do cabeçalho</label>
          <Input
            className="mt-1"
            value={headerImageUrl}
            onChange={(e) => setHeaderImageUrl(e.target.value)}
            placeholder="https://..."
          />
          <div className="mt-1">
            <CloudinaryImageUpload
              kind="inscreva"
              currentUrl={headerImageUrl || undefined}
              onUploaded={setHeaderImageUrl}
              label="Ou envie uma imagem"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
