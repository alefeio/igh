"use client";

import { useEffect, useState } from "react";

import { SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { ApimagesImageUpload } from "@/components/admin/ApimagesImageUpload";
import { PublicCalendarHighlightBanner } from "@/components/site/PublicCalendarHighlightBanner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";
import type { HolidayCalendarBannerAdmin, HolidayCalendarBannerPublic } from "@/lib/holiday-calendar-banner";

async function parseApiJson<T>(res: Response): Promise<ApiResponse<T> | null> {
  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return null;
  }
}

export function HolidayCalendarBannerEditor() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaHref, setCtaHref] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/holidays/calendar-banner");
      const json = await parseApiJson<{ banner: HolidayCalendarBannerAdmin }>(res);
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Falha ao carregar banner.");
        return;
      }
      const b = json.data.banner;
      setTitle(b.title);
      setSubtitle(b.subtitle ?? "");
      setCtaLabel(b.ctaLabel ?? "");
      setCtaHref(b.ctaHref ?? "");
      setImageUrl(b.imageUrl ?? "");
      setIsActive(b.isActive);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (isActive && !title.trim()) {
      toast.push("error", "Informe um título para ativar o banner.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/holidays/calendar-banner", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          subtitle: subtitle.trim() || null,
          ctaLabel: ctaLabel.trim() || null,
          ctaHref: ctaHref.trim() || null,
          imageUrl: imageUrl.trim() || null,
          isActive,
        }),
      });
      const json = await parseApiJson<{ banner: HolidayCalendarBannerAdmin }>(res);
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Falha ao salvar banner.");
        return;
      }
      const b = json.data.banner;
      toast.push(
        "success",
        b.isActive && b.title.trim()
          ? "Banner publicado em /calendario."
          : "Banner salvo. Ative e informe um título para exibir em /calendario."
      );
      setTitle(b.title);
      setSubtitle(b.subtitle ?? "");
      setCtaLabel(b.ctaLabel ?? "");
      setCtaHref(b.ctaHref ?? "");
      setImageUrl(b.imageUrl ?? "");
      setIsActive(b.isActive);
    } finally {
      setSaving(false);
    }
  }

  const preview: HolidayCalendarBannerPublic | null =
    isActive && title.trim()
      ? {
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          ctaLabel: ctaLabel.trim() || null,
          ctaHref: ctaHref.trim() || null,
          imageUrl: imageUrl.trim() || null,
        }
      : null;

  return (
    <SectionCard
      title="Banner do calendário público"
      description="Destaque horizontal exibido em /calendario. Use para promover um evento, campanha ou aviso institucional."
    >
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando banner…</p>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={save}>
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              isActive && title.trim()
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900"
                : "border-amber-500/40 bg-amber-500/10 text-amber-950"
            }`}
          >
            {isActive && title.trim() ? (
              <p>
                <strong>Publicado.</strong> O banner aparece em{" "}
                <a href="/calendario" target="_blank" rel="noreferrer" className="underline">
                  /calendario
                </a>{" "}
                logo acima do calendário.
              </p>
            ) : (
              <p>
                <strong>Não visível no site.</strong> Marque{" "}
                <em>Exibir banner ativo no calendário público</em> e preencha o título para publicar em{" "}
                <a href="/calendario" target="_blank" rel="noreferrer" className="underline">
                  /calendario
                </a>
                .
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Exibir banner ativo no calendário público
          </label>
          <div>
            <label className="text-sm font-medium">Título</label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Subtítulo (opcional)</label>
            <Input className="mt-1" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Texto do botão (opcional)</label>
              <Input className="mt-1" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Link do botão (opcional)</label>
              <Input
                className="mt-1"
                value={ctaHref}
                onChange={(e) => setCtaHref(e.target.value)}
                placeholder="/calendario?date=2026-07-15&event=..."
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">URL da imagem de fundo (opcional)</label>
            <Input
              className="mt-1"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
            <ApimagesImageUpload
              kind="banners"
              currentUrl={imageUrl || undefined}
              onUploaded={setImageUrl}
              label="Ou envie uma imagem"
            />
          </div>
          {preview ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Prévia</p>
              <PublicCalendarHighlightBanner banner={preview} />
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar banner"}
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}
