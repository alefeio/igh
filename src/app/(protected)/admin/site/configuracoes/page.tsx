"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

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
  addressLine: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  businessHours: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialYoutube: string | null;
  socialLinkedin: string | null;
  seoTitleDefault: string | null;
  seoDescriptionDefault: string | null;
};

const empty = (s: string | null | undefined) => s ?? "";

export default function ConfiguracoesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site/settings");
      const json = (await res.json()) as ApiResponse<{ settings: Settings }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar.");
        return;
      }
      const s = json.data.settings;
      setSettings(s);
      setForm({
        siteName: empty(s.siteName),
        logoUrl: empty(s.logoUrl),
        faviconUrl: empty(s.faviconUrl),
        primaryColor: empty(s.primaryColor),
        secondaryColor: empty(s.secondaryColor),
        contactEmail: empty(s.contactEmail),
        contactPhone: empty(s.contactPhone),
        contactWhatsapp: empty(s.contactWhatsapp),
        addressLine: empty(s.addressLine),
        addressCity: empty(s.addressCity),
        addressState: empty(s.addressState),
        addressZip: empty(s.addressZip),
        businessHours: empty(s.businessHours),
        socialInstagram: empty(s.socialInstagram),
        socialFacebook: empty(s.socialFacebook),
        socialYoutube: empty(s.socialYoutube),
        socialLinkedin: empty(s.socialLinkedin),
        seoTitleDefault: empty(s.seoTitleDefault),
        seoDescriptionDefault: empty(s.seoDescriptionDefault),
      });
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
      const res = await fetch("/api/admin/site/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as ApiResponse<{ settings: Settings }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", "Configurações salvas.");
      setSettings(json.data.settings);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-lg font-semibold">Configurações do site</div>
        <div className="text-sm text-zinc-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-lg font-semibold">Configurações do site</div>
        <div className="text-sm text-zinc-600">Logo, identidade, contato, redes sociais e SEO.</div>
      </div>

      <form className="flex flex-col gap-6" onSubmit={save}>
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
            </div>
            <div>
              <label className="text-sm font-medium">URL do favicon</label>
              <Input
                className="mt-1"
                value={form.faviconUrl ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, faviconUrl: e.target.value }))}
                placeholder="https://..."
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
              <label className="text-sm font-medium">Endereço (linha)</label>
              <Input
                className="mt-1"
                value={form.addressLine ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Cidade</label>
                <Input
                  className="mt-1"
                  value={form.addressCity ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, addressCity: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Estado</label>
                <Input
                  className="mt-1"
                  value={form.addressState ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, addressState: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">CEP</label>
                <Input
                  className="mt-1"
                  value={form.addressZip ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, addressZip: e.target.value }))}
                />
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
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                rows={3}
                value={form.seoDescriptionDefault ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, seoDescriptionDefault: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </form>
    </div>
  );
}
