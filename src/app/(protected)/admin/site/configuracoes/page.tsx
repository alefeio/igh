"use client";

import { useEffect, useState } from "react";
import { ApimagesImageUpload } from "@/components/admin/ApimagesImageUpload";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";
import QRCode from "qrcode";

type AddressEntry = { line: string; city: string; state: string; zip: string };

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

  async function parseJson<T>(res: Response): Promise<T | null> {
    const text = await res.text();
    if (!text?.trim()) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
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
        const url = await QRCode.toDataURL(link, {
          errorCorrectionLevel: "H",
          margin: 2,
          width: 512,
          color: { dark: "#000000", light: "#FFFFFF" },
        });
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
  }, [qrLink]);

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

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-[var(--text-secondary)]">
                {qrGenerating ? "Gerando…" : qrDataUrl ? "Prévia pronta." : "Informe um link para gerar."}
              </div>
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`qrcode${qrTitle.trim() ? "-" + qrTitle.trim().replace(/\\s+/g, "-").toLowerCase() : ""}.png`}
                  className="inline-flex items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:opacity-90"
                >
                  Baixar PNG
                </a>
              )}
            </div>

            {qrDataUrl && (
              <div className="flex flex-col items-center gap-3">
                {qrTitle.trim() && <div className="text-sm font-semibold">{qrTitle.trim()}</div>}
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QR Code" className="h-64 w-64 rounded-lg border border-[var(--card-border)] bg-white" />
                  {qrCenterImageUrl.trim() && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrCenterImageUrl.trim()}
                      alt=""
                      className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white bg-white object-cover shadow"
                    />
                  )}
                </div>
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
