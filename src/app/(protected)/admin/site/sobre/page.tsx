"use client";

import { useEffect, useState } from "react";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CloudinaryImageUpload } from "@/components/admin/CloudinaryImageUpload";
import type { ApiErr, ApiResponse } from "@/lib/api-types";

type AboutItem = {
  id: string;
  title: string | null;
  subtitle: string | null;
  content: string | null;
  imageUrl: string | null;
};

export default function SobrePage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site/about");
      const json = (await res.json()) as ApiResponse<{ item: AboutItem | null }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao carregar.");
        return;
      }
      const item = json.data.item;
      if (item) {
        setTitle(item.title ?? "");
        setSubtitle(item.subtitle ?? "");
        setContent(item.content ?? "");
        setImageUrl(item.imageUrl ?? "");
      } else {
        setTitle("");
        setSubtitle("");
        setContent("");
        setImageUrl("");
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
      const res = await fetch("/api/admin/site/about", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          subtitle: subtitle.trim() || null,
          content: content.trim() || null,
          imageUrl: imageUrl.trim() || null,
        }),
      });
      const text = await res.text();
      let json: ApiResponse<{ item: AboutItem }>;
      try {
        json = (text ? JSON.parse(text) : { ok: false, error: { code: "UNKNOWN", message: "Resposta vazia do servidor." } }) as ApiResponse<{ item: AboutItem }>;
      } catch {
        json = { ok: false, error: { code: "INVALID_JSON", message: "Resposta inválida do servidor." } } as ApiErr;
      }
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", "Página Sobre atualizada.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-lg font-semibold">Sobre</div>
        <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-lg font-semibold">Sobre</div>
        <div className="text-sm text-[var(--text-secondary)]">Conteúdo exibido na página /sobre do site.</div>
      </div>
      <form className="flex flex-col gap-4" onSubmit={save}>
        <div>
          <label className="text-sm font-medium">Título</label>
          <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Sobre o IGH" />
        </div>
        <div>
          <label className="text-sm font-medium">Subtítulo</label>
          <Input className="mt-1" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ex: Conheça nossa missão..." />
        </div>
        <div className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-4">
          <label className="text-sm font-medium">Foto</label>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Imagem exibida na página Sobre do site. Cole a URL ou use o botão para enviar.</p>
          <Input className="mt-2" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
          <div className="mt-2">
            <CloudinaryImageUpload kind="about" currentUrl={imageUrl || undefined} onUploaded={setImageUrl} label="Ou envie uma imagem" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Conteúdo</label>
          <RichTextEditor value={content} onChange={setContent} minHeight="200px" className="mt-1" />
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
