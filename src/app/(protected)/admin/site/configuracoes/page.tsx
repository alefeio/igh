"use client";

import { useEffect, useState } from "react";
import { ApimagesImageUpload } from "@/components/admin/ApimagesImageUpload";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";
import { apimagesUploadHeaders, buildApimagesUploadFormData, parseApimagesUploadJson } from "@/lib/apimages-upload";
import QRCode from "qrcode";

type AddressEntry = { line: string; city: string; state: string; zip: string };

type SiteQrCodeRow = {
  id: string;
  title: string | null;
  link: string;
  centerImageUrl: string | null;
  imageUrl: string;
  createdAt: string;
};

type Settings = {
  id: string;
  siteName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  addresses: AddressEntry[];
  businessHours: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialYoutube: string | null;
  socialLinkedin: string | null;
  seoTitleDefault: string | null;
  seoDescriptionDefault: string | null;
  /** Base para links em e-mails (campanhas): {link}, {link_area_aluno} */
  publicAppUrl: string | null;
};

const empty = (s: string | null | undefined) => s ?? "";
const emptyAddress = (): AddressEntry => ({ line: "", city: "", state: "", zip: "" });

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Data URL inválida.");
  const header = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const mimeMatch = /data:([^;]+)/.exec(header);
  const mime = mimeMatch?.[1] ?? "image/png";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Carrega imagem de URL de forma utilizável no canvas (evita “taint” quando possível). */
async function loadCenterDrawable(url: string): Promise<CanvasImageSource> {
  try {
    const res = await fetch(url.trim(), { mode: "cors", credentials: "omit" });
    if (res.ok) {
      const blob = await res.blob();
      return await createImageBitmap(blob);
    }
  } catch {
    // tenta <img> abaixo
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load"));
    img.src = url.trim();
  });
}

async function buildQrCompositePngDataUrl(link: string, centerUrl: string | null): Promise<string> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, link, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 512,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  const w = canvas.width;
  if (!centerUrl?.trim()) {
    return canvas.toDataURL("image/png");
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");

  let drawable: CanvasImageSource;
  try {
    drawable = await loadCenterDrawable(centerUrl);
  } catch {
    throw new Error(
      "Não foi possível carregar a imagem central para compor o arquivo. Verifique o link ou envie a imagem novamente."
    );
  }

  const logoSize = Math.round(w * 0.22);
  const x = (w - logoSize) / 2;
  const y = (w - logoSize) / 2;
  const pad = Math.max(2, Math.round(w * 0.015));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2);
  ctx.drawImage(drawable, x, y, logoSize, logoSize);
  if (drawable instanceof ImageBitmap) drawable.close();

  return canvas.toDataURL("image/png");
}

export default function ConfiguracoesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [addresses, setAddresses] = useState<AddressEntry[]>([emptyAddress()]);

  const [qrTitle, setQrTitle] = useState("");
  const [qrLink, setQrLink] = useState("");
  const [qrCenterImageUrl, setQrCenterImageUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrSavingRemote, setQrSavingRemote] = useState(false);
  const [qrSavedList, setQrSavedList] = useState<SiteQrCodeRow[]>([]);
  const [qrDeletingId, setQrDeletingId] = useState<string | null>(null);

  async function parseJson<T>(res: Response): Promise<T | null> {
    const text = await res.text();
    if (!text?.trim()) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  async function loadQrCodes() {
    try {
      const res = await fetch("/api/admin/site/qr-codes");
      const json = await parseJson<ApiResponse<{ items: SiteQrCodeRow[] }>>(res);
      if (res.ok && json?.ok && Array.isArray(json.data?.items)) {
        setQrSavedList(json.data.items);
      }
    } catch {
      // ignore
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site/settings");
      const json = await parseJson<ApiResponse<{ settings: Settings }>>(res);
      if (!json) {
        toast.push("error", res.ok ? "Resposta inválida do servidor." : "Falha ao carregar. Verifique se está logado.");
        return;
      }
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Falha ao carregar." : "Falha ao carregar.");
        return;
      }
      const s = json.data.settings;
      setSettings(s);
      const raw = (s as { addresses?: unknown }).addresses;
      const addrs =
        Array.isArray(raw) && raw.length > 0
          ? raw.map((a: unknown) => {
              const x = a && typeof a === "object" && "line" in a ? (a as AddressEntry) : null;
              return {
                line: x?.line ?? "",
                city: x?.city ?? "",
                state: x?.state ?? "",
                zip: x?.zip ?? "",
              };
            })
          : [emptyAddress()];
      setForm({
        siteName: empty(s.siteName),
        logoUrl: empty(s.logoUrl),
        faviconUrl: empty(s.faviconUrl),
        primaryColor: empty(s.primaryColor),
        secondaryColor: empty(s.secondaryColor),
        contactEmail: empty(s.contactEmail),
        contactPhone: empty(s.contactPhone),
        contactWhatsapp: empty(s.contactWhatsapp),
        businessHours: empty(s.businessHours),
        socialInstagram: empty(s.socialInstagram),
        socialFacebook: empty(s.socialFacebook),
        socialYoutube: empty(s.socialYoutube),
        socialLinkedin: empty(s.socialLinkedin),
        seoTitleDefault: empty(s.seoTitleDefault),
        seoDescriptionDefault: empty(s.seoDescriptionDefault),
        publicAppUrl: empty((s as Settings).publicAppUrl),
      });
      setAddresses(addrs.map((a: AddressEntry) => ({ ...a })));
    } finally {
      setLoading(false);
      void loadQrCodes();
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const link = qrLink.trim();
    if (!link) {
      setQrDataUrl("");
      setQrError(null);
      return;
    }
    let canceled = false;
    setQrGenerating(true);
    setQrError(null);
    void (async () => {
      try {
        const url = await buildQrCompositePngDataUrl(link, qrCenterImageUrl.trim() || null);
        if (canceled) return;
        setQrDataUrl(url);
      } catch (e) {
        if (canceled) return;
        setQrDataUrl("");
        setQrError(e instanceof Error ? e.message : "Falha ao gerar QR Code.");
      } finally {
        if (!canceled) setQrGenerating(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [qrLink, qrCenterImageUrl]);

  async function saveQrToServer() {
    if (!qrDataUrl.trim()) {
      toast.push("error", "Gere o QR Code antes de salvar.");
      return;
    }
    setQrSavingRemote(true);
    try {
      const blob = dataUrlToBlob(qrDataUrl);
      const safeName = qrTitle.trim()
        ? `qrcode-${qrTitle.trim().replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/gi, "")}.png`
        : `qrcode-${Date.now()}.png`;
      const file = new File([blob], safeName, { type: "image/png" });

      const signRes = await fetch("/api/admin/site/uploads/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "qrcode" }),
      });
      const signJson = (await signRes.json()) as ApiResponse<{ uploadUrl: string; apiKey: string }>;
      if (!signRes.ok || !signJson.ok) {
        toast.push("error", !signJson.ok ? signJson.error.message : "Falha ao preparar upload.");
        return;
      }

      const uploadRes = await fetch(signJson.data.uploadUrl, {
        method: "POST",
        headers: apimagesUploadHeaders(signJson.data.apiKey),
        body: buildApimagesUploadFormData(file),
      });
      const uploadJson = await uploadRes.json();
      const parsed = parseApimagesUploadJson(uploadJson);
      if (!uploadRes.ok || parsed.errorMessage || !parsed.url) {
        toast.push("error", parsed.errorMessage ?? "Falha ao enviar o PNG.");
        return;
      }

      const saveRes = await fetch("/api/admin/site/qr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: qrTitle.trim() || null,
          link: qrLink.trim(),
          centerImageUrl: qrCenterImageUrl.trim() || null,
          imageUrl: parsed.url,
        }),
      });
      const saveJson = await parseJson<ApiResponse<{ item: SiteQrCodeRow }>>(saveRes);
      if (!saveRes.ok || !saveJson?.ok) {
        toast.push(
          "error",
          saveJson && "error" in saveJson ? saveJson.error.message : "Falha ao gravar no banco de dados."
        );
        return;
      }

      await loadQrCodes();
      toast.push("success", "QR Code salvo no banco de dados (imagem no CDN + registro com título e link).");
    } catch {
      toast.push("error", "Não foi possível salvar o QR Code.");
    } finally {
      setQrSavingRemote(false);
    }
  }

  async function deleteQrCode(id: string) {
    if (!confirm("Excluir este QR Code do histórico? A imagem no CDN permanece.")) return;
    setQrDeletingId(id);
    try {
      const res = await fetch(`/api/admin/site/qr-codes/${id}`, { method: "DELETE" });
      const json = await parseJson<ApiResponse<{ deleted: boolean }>>(res);
      if (!res.ok || !json?.ok) {
        toast.push("error", json && "error" in json ? json.error.message : "Falha ao excluir.");
        return;
      }
      toast.push("success", "Registro excluído.");
      await loadQrCodes();
    } catch {
      toast.push("error", "Falha ao excluir.");
    } finally {
      setQrDeletingId(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, addresses }),
      });
      const json = await parseJson<ApiResponse<{ settings: Settings }>>(res);
      if (!json) {
        toast.push("error", res.ok ? "Resposta inválida do servidor." : "Falha ao salvar. Verifique se está logado.");
        return;
      }
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Falha ao salvar." : "Falha ao salvar.");
        return;
      }
      toast.push("success", "Configurações salvas.");
      const next = json.data.settings as Settings;
      setSettings(next);
      const raw = next?.addresses;
      setAddresses(
        Array.isArray(raw) && raw.length > 0
          ? raw.map((a: AddressEntry) => ({
              line: a?.line ?? "",
              city: a?.city ?? "",
              state: a?.state ?? "",
              zip: a?.zip ?? "",
            }))
          : [emptyAddress()]
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-lg font-semibold">Configurações do site</div>
        <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-lg font-semibold">Configurações do site</div>
        <div className="text-sm text-[var(--text-secondary)]">
          Logo, identidade, contato, links em e-mails, redes sociais e SEO.
        </div>
      </div>

      <form className="flex flex-col gap-6" onSubmit={save}>
        <div className="card">
          <div className="card-header">URL pública do site (e-mails)</div>
          <div className="card-body flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium">URL base (https://…)</label>
              <Input
                className="mt-1"
                value={form.publicAppUrl ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, publicAppUrl: e.target.value }))}
                placeholder="https://www.instituto.com.br"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Usada nos placeholders <code className="rounded bg-[var(--bg-muted)] px-1">{"{link}"}</code>,{" "}
                <code className="rounded bg-[var(--bg-muted)] px-1">{"{link_area_aluno}"}</code> e similares nas{" "}
                <strong>campanhas de e-mail</strong>, quando a variável <code className="px-1">APP_URL</code> não está
                definida no servidor. Se <code className="px-1">APP_URL</code> existir no .env, ela tem prioridade.
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Identidade</div>
          <div className="card-body flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium">Nome do site</label>
              <Input
                className="mt-1"
                value={form.siteName ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">URL da logo</label>
              <Input
                className="mt-1"
                value={form.logoUrl ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                placeholder="https://..."
              />
              <ApimagesImageUpload
                kind="logo"
                currentUrl={form.logoUrl || undefined}
                onUploaded={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
                label="Ou envie uma imagem"
              />
            </div>
            <div>
              <label className="text-sm font-medium">URL do favicon</label>
              <Input
                className="mt-1"
                value={form.faviconUrl ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, faviconUrl: e.target.value }))}
                placeholder="https://..."
              />
              <ApimagesImageUpload
                kind="favicon"
                currentUrl={form.faviconUrl || undefined}
                onUploaded={(url) => setForm((f) => ({ ...f, faviconUrl: url }))}
                label="Ou envie uma imagem"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Cor primária (hex)</label>
                <Input
                  className="mt-1"
                  value={form.primaryColor ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  placeholder="#0066b3"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Cor secundária (hex)</label>
                <Input
                  className="mt-1"
                  value={form.secondaryColor ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                  placeholder="#1a365d"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Contato</div>
          <div className="card-body flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium">E-mail</label>
              <Input
                className="mt-1"
                type="email"
                value={form.contactEmail ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Telefone</label>
                <Input
                  className="mt-1"
                  value={form.contactPhone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">WhatsApp</label>
                <Input
                  className="mt-1"
                  value={form.contactWhatsapp ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, contactWhatsapp: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Endereços (unidades)</label>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Adicione um endereço por unidade.</p>
              <div className="mt-2 space-y-4">
                {addresses.map((addr, idx) => (
                  <div key={idx} className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--text-secondary)]">Unidade {idx + 1}</span>
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-red-600"
                        onClick={() => setAddresses((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={addresses.length <= 1}
                      >
                        Remover
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="text-xs text-[var(--text-muted)]">Logradouro / número / complemento</label>
                        <Input
                          className="mt-1"
                          value={addr.line}
                          onChange={(e) =>
                            setAddresses((prev) =>
                              prev.map((a, i) => (i === idx ? { ...a, line: e.target.value } : a))
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--text-muted)]">Cidade</label>
                        <Input
                          className="mt-1"
                          value={addr.city}
                          onChange={(e) =>
                            setAddresses((prev) =>
                              prev.map((a, i) => (i === idx ? { ...a, city: e.target.value } : a))
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--text-muted)]">Estado</label>
                        <Input
                          className="mt-1"
                          value={addr.state}
                          onChange={(e) =>
                            setAddresses((prev) =>
                              prev.map((a, i) => (i === idx ? { ...a, state: e.target.value } : a))
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--text-muted)]">CEP</label>
                        <Input
                          className="mt-1"
                          value={addr.zip}
                          onChange={(e) =>
                            setAddresses((prev) =>
                              prev.map((a, i) => (i === idx ? { ...a, zip: e.target.value } : a))
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAddresses((prev) => [...prev, emptyAddress()])}
                >
                  Adicionar unidade
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Horário de funcionamento</label>
              <Input
                className="mt-1"
                value={form.businessHours ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, businessHours: e.target.value }))}
                placeholder="Segunda a sexta, 9h às 18h"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Redes sociais</div>
          <div className="card-body grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Instagram</label>
              <Input className="mt-1" value={form.socialInstagram ?? ""} onChange={(e) => setForm((f) => ({ ...f, socialInstagram: e.target.value }))} placeholder="URL" />
            </div>
            <div>
              <label className="text-sm font-medium">Facebook</label>
              <Input className="mt-1" value={form.socialFacebook ?? ""} onChange={(e) => setForm((f) => ({ ...f, socialFacebook: e.target.value }))} placeholder="URL" />
            </div>
            <div>
              <label className="text-sm font-medium">Youtube</label>
              <Input className="mt-1" value={form.socialYoutube ?? ""} onChange={(e) => setForm((f) => ({ ...f, socialYoutube: e.target.value }))} placeholder="URL" />
            </div>
            <div>
              <label className="text-sm font-medium">LinkedIn</label>
              <Input className="mt-1" value={form.socialLinkedin ?? ""} onChange={(e) => setForm((f) => ({ ...f, socialLinkedin: e.target.value }))} placeholder="URL" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">SEO (padrão)</div>
          <div className="card-body flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium">Título padrão</label>
              <Input
                className="mt-1"
                value={form.seoTitleDefault ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, seoTitleDefault: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição padrão</label>
              <textarea
                className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
                rows={3}
                value={form.seoDescriptionDefault ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, seoDescriptionDefault: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Gerar QR Code</div>
          <div className="card-body flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium">Título (opcional)</label>
              <Input
                className="mt-1"
                value={qrTitle}
                onChange={(e) => setQrTitle(e.target.value)}
                placeholder="Ex.: Link do WhatsApp, Página de inscrição, etc."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Link</label>
              <Input
                className="mt-1"
                value={qrLink}
                onChange={(e) => setQrLink(e.target.value)}
                placeholder="https://..."
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Dica: use links completos com <code className="px-1">https://</code>.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Imagem central (opcional)</label>
              <ApimagesImageUpload
                kind="qrcode"
                currentUrl={qrCenterImageUrl || undefined}
                onUploaded={(url) => setQrCenterImageUrl(url)}
                label="Enviar imagem"
                accept="image/*"
              />
            </div>

            {qrError && <p className="text-sm text-red-600">{qrError}</p>}

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="text-sm text-[var(--text-secondary)]">
                {qrGenerating
                  ? "Gerando…"
                  : qrDataUrl
                    ? "Prévia pronta (PNG inclui a imagem central, se houver)."
                    : "Informe um link para gerar."}
              </div>
              {qrDataUrl && (
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={qrDataUrl}
                    download={`qrcode${qrTitle.trim() ? "-" + qrTitle.trim().replace(/\s+/g, "-").toLowerCase() : ""}.png`}
                    className="inline-flex items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:opacity-90"
                  >
                    Baixar PNG
                  </a>
                  <Button type="button" variant="secondary" disabled={qrSavingRemote} onClick={() => void saveQrToServer()}>
                    {qrSavingRemote ? "Salvando…" : "Salvar no banco"}
                  </Button>
                </div>
              )}
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Ao salvar, o PNG é enviado ao CDN e um registro é criado no PostgreSQL com título, link, imagem central (se houver) e URL do arquivo gerado.
            </p>

            {qrSavedList.length > 0 && (
              <div className="overflow-x-auto rounded-md border border-[var(--card-border)]">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="px-3 py-2 font-medium">Título</th>
                      <th className="px-3 py-2 font-medium">Link</th>
                      <th className="px-3 py-2 font-medium">QR (PNG)</th>
                      <th className="px-3 py-2 font-medium w-28" />
                    </tr>
                  </thead>
                  <tbody>
                    {qrSavedList.map((row) => (
                      <tr key={row.id} className="border-b border-[var(--card-border)] last:border-0">
                        <td className="px-3 py-2 whitespace-nowrap text-[var(--text-muted)]">
                          {new Date(row.createdAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-3 py-2 max-w-[140px] truncate" title={row.title ?? ""}>
                          {row.title ?? "—"}
                        </td>
                        <td className="px-3 py-2 max-w-[200px]">
                          <a href={row.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">
                            {row.link}
                          </a>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={row.imageUrl} alt="" className="h-12 w-12 rounded border border-[var(--card-border)] bg-white object-contain" />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                void navigator.clipboard.writeText(row.imageUrl);
                                toast.push("success", "Link da imagem copiado.");
                              }}
                            >
                              Copiar URL
                            </Button>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="text-red-600"
                            disabled={qrDeletingId === row.id}
                            onClick={() => void deleteQrCode(row.id)}
                          >
                            {qrDeletingId === row.id ? "…" : "Excluir"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {qrDataUrl && (
              <div className="flex flex-col items-center gap-3">
                {qrTitle.trim() && <div className="text-sm font-semibold">{qrTitle.trim()}</div>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR Code" className="h-64 w-64 rounded-lg border border-[var(--card-border)] bg-white" />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </form>
    </div>
  );
}
