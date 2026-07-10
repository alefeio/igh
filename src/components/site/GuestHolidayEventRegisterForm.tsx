"use client";

import { useState } from "react";

import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/site/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

function formatPhoneInput(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatCpfInput(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function GuestHolidayEventRegisterForm({
  holidayId,
  occurrenceDate,
  turnstileSiteKey = null,
  onSuccess,
}: {
  holidayId: string;
  occurrenceDate: string;
  turnstileSiteKey?: string | null;
  onSuccess?: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [website, setWebsite] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (turnstileSiteKey && !captchaToken) {
      toast.push("error", "Confirme que você não é um robô antes de continuar.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/public/holiday-events/${holidayId}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          occurrenceDate,
          name,
          phone,
          email: email.trim() || undefined,
          cpf: cpf.trim() || undefined,
          captchaToken,
          website,
        }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<{
        message?: string;
        alreadyRegistered?: boolean;
      }> | null;
      if (!res.ok || !json || !json.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Não foi possível concluir a inscrição.");
        return;
      }
      toast.push("success", json.data.message ?? "Inscrição realizada!");
      setName("");
      setPhone("");
      setEmail("");
      setCpf("");
      onSuccess?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="relative mt-3 flex flex-col gap-3 rounded-lg border border-[var(--igh-border)] bg-white p-3">
      <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor={`guest-website-${holidayId}`}>Website</label>
        <input
          id={`guest-website-${holidayId}`}
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <p className="text-sm font-medium text-[var(--igh-secondary)]">Inscrição rápida (sem criar conta)</p>
      <div>
        <label className="text-xs font-medium text-[var(--igh-muted)]">Nome *</label>
        <div className="mt-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Seu nome completo" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--igh-muted)]">Telefone / WhatsApp *</label>
        <div className="mt-1">
          <Input
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            type="tel"
            inputMode="numeric"
            required
            placeholder="(91) 99999-9999"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--igh-muted)]">E-mail (opcional)</label>
        <div className="mt-1">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="seu@email.com" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--igh-muted)]">CPF (opcional)</label>
        <div className="mt-1">
          <Input
            value={cpf}
            onChange={(e) => setCpf(formatCpfInput(e.target.value))}
            inputMode="numeric"
            placeholder="000.000.000-00"
          />
        </div>
      </div>
      {turnstileSiteKey ? (
        <TurnstileWidget siteKey={turnstileSiteKey} onToken={setCaptchaToken} />
      ) : null}
      <Button type="submit" disabled={loading || (!!turnstileSiteKey && !captchaToken)}>
        {loading ? "Enviando…" : "Confirmar inscrição"}
      </Button>
    </form>
  );
}
