"use client";

import { useEffect, useState } from "react";
import { ApimagesImageUpload } from "@/components/admin/ApimagesImageUpload";
import { MediaCarousel } from "@/components/site";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import type { ApiErr, ApiResponse } from "@/lib/api-types";
import { ESPACO_MAKER_PAGE_DEFAULT } from "@/content/espaco-maker";
import { isVideoUrl } from "@/lib/media-url";

type EspacoMakerItem = {
  id: string;
  title: string | null;
  subtitle: string | null;
  content: string | null;
  mediaUrls: string[];
};

export default function AdminEspacoMakerPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(ESPACO_MAKER_PAGE_DEFAULT.title);
  const [subtitle, setSubtitle] = useState(ESPACO_MAKER_PAGE_DEFAULT.subtitle);
  const [content, setContent] = useState(ESPACO_MAKER_PAGE_DEFAULT.content);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site/espaco-maker-page");
      const json = (await res.json()) as ApiResponse<{ item: EspacoMakerItem | null }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao carregar.");
        return;
      }
      const item = json.data.item;
      if (item) {
        setTitle(item.title ?? "");
        setSubtitle(item.subtitle ?? "");
        setContent(item.content ?? "");
        setMediaUrls(Array.isArray(item.mediaUrls) ? item.mediaUrls : []);
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
      const res = await fetch("/api/admin/site/espaco-maker-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          subtitle: subtitle.trim() || null,
          content: content.trim() || null,
          mediaUrls: mediaUrls.filter((u) => u.trim()),
        }),
      });
      const text = await res.text();
      let json: ApiResponse<{ item?: EspacoMakerItem; pending?: boolean; message?: string }>;
      try {
        json = (text
          ? JSON.parse(text)
          : { ok: false, error: { code: "UNKNOWN", message: "Resposta vazia do servidor." } }) as typeof json;
      } catch {
        json = {
          ok: false,
          error: { code: "INVALID_JSON", message: "Resposta inválida do servidor." },
        } as ApiErr;
      }
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as ApiErr).error.message : "Falha ao salvar.");
        return;
      }
      toast.push(
        "success",
        json.data.pending
          ? json.data.message ?? "Alteração enviada para aprovação do Master."
          : "Página Espaço Maker atualizada."
      );
      if (json.data.item) {
        setMediaUrls(json.data.item.mediaUrls ?? []);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-lg font-semibold">Espaço Maker</div>
        <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-lg font-semibold">Espaço Maker</div>
        <div className="text-sm text-[var(--text-secondary)]">
          Conteúdo exibido na página /espaco-maker do site.
        </div>
      </div>

      <form className="flex flex-col gap-4" onSubmit={save}>
        <div>
          <label className="text-sm font-medium">Título</label>
          <Input
            className="mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Espaço Maker IGH"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Subtítulo</label>
          <Input
            className="mt-1"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Ex: Tecnologia, criatividade e inclusão..."
          />
        </div>

        <div className="rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-4">
          <label className="text-sm font-medium">Carrossel de imagens e vídeos</label>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Exibido logo abaixo do título e subtítulo. No site, até 3 itens aparecem ao mesmo tempo, com setas
            para navegar. Aceita imagem ou vídeo.
          </p>

          <div className="mt-3 space-y-3">
            {mediaUrls.map((url, i) => (
              <div
                key={i}
                className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <Input
                    className="flex-1"
                    value={url}
                    onChange={(e) => {
                      const next = [...mediaUrls];
                      next[i] = e.target.value;
                      setMediaUrls(next);
                    }}
                    placeholder="https://..."
                  />
                  <div className="flex shrink-0 gap-2">
                    <ApimagesImageUpload
                      kind="espaco-maker"
                      accept="image/*,video/*"
                      currentUrl={url || undefined}
                      onUploaded={(u) => {
                        const next = [...mediaUrls];
                        next[i] = u;
                        setMediaUrls(next);
                      }}
                      label={isVideoUrl(url) ? "Trocar vídeo" : "Enviar mídia"}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="shrink-0 text-red-600"
                      onClick={() => setMediaUrls(mediaUrls.filter((_, j) => j !== i))}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMediaUrls([...mediaUrls, ""])}
              >
                + Adicionar item
              </Button>
              <ApimagesImageUpload
                kind="espaco-maker"
                accept="image/*,video/*"
                multiple
                onUploaded={(u) => setMediaUrls((prev) => [...prev, u])}
                label="Ou enviar vários arquivos"
              />
            </div>
          </div>

          {mediaUrls.some((u) => u.trim()) && (
            <div className="mt-4 overflow-hidden rounded-md border border-[var(--card-border)]">
              <p className="mb-0 border-b border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs font-medium text-[var(--text-muted)]">
                Pré-visualização do carrossel (largura total no site)
              </p>
              <MediaCarousel urls={mediaUrls} fullBleed />
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Conteúdo</label>
          <RichTextEditor value={content} onChange={setContent} minHeight="320px" className="mt-1" />
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
