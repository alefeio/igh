"use client";

import { useState } from "react";
import { Card, Button } from "@/components/site";

function capitalizeEachWord(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ""))
    .join(" ");
}

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function phoneDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function ContatoForm() {
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [nome, setNome] = useState("");
  const [telefoneDisplay, setTelefoneDisplay] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    let nomeVal = (data.get("nome") as string)?.trim();
    const email = (data.get("email") as string)?.trim();
    const telefoneDigits = phoneDigitsOnly(telefoneDisplay);
    const assunto = (data.get("assunto") as string)?.trim();
    const mensagem = (data.get("mensagem") as string)?.trim();

    nomeVal = capitalizeEachWord(nomeVal);

    const next: Record<string, string> = {};
    if (!nomeVal) next.nome = "Informe seu nome.";
    if (!email) next.email = "Informe seu e-mail.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "E-mail inválido.";
    if (!telefoneDigits) next.telefone = "Informe o telefone.";
    else if (telefoneDigits.length < 10) next.telefone = "Telefone deve ter pelo menos 10 dígitos.";
    if (!mensagem) next.mensagem = "Informe a mensagem.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    fetch("/api/public/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nomeVal,
        email,
        phone: telefoneDigits,
        message: mensagem,
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json?.ok !== true) {
          setErrors({ form: json?.error?.message ?? "Falha ao enviar. Tente novamente." });
          return;
        }
        setSent(true);
      })
      .catch(() => setErrors({ form: "Falha ao enviar. Tente novamente." }))
      .finally(() => setSubmitting(false));
  }

  function handleNomeBlur(e: React.FocusEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (v.trim()) setNome(capitalizeEachWord(v));
  }

  function handleTelefoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    setTelefoneDisplay(formatPhoneDisplay(digits));
  }

  return (
    <div className="lg:col-span-2">
      {sent ? (
        <Card>
          <p className="font-medium text-[var(--igh-secondary)]">
            Mensagem enviada com sucesso. Em breve entraremos em contato.
          </p>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-[var(--igh-secondary)]">
              Nome *
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onBlur={handleNomeBlur}
              className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] px-3 py-2 text-[var(--igh-secondary)]"
            />
            {errors.nome && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.nome}</p>}
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--igh-secondary)]">
              E-mail *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] px-3 py-2 text-[var(--igh-secondary)]"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="telefone" className="block text-sm font-medium text-[var(--igh-secondary)]">
              Telefone / WhatsApp *
            </label>
            <input
              id="telefone"
              name="telefone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={telefoneDisplay}
              onChange={handleTelefoneChange}
              placeholder="(00) 00000-0000"
              className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] px-3 py-2 text-[var(--igh-secondary)]"
            />
            {errors.telefone && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.telefone}</p>}
          </div>
          <div>
            <label htmlFor="assunto" className="block text-sm font-medium text-[var(--igh-secondary)]">
              Assunto (opcional)
            </label>
            <input
              id="assunto"
              name="assunto"
              type="text"
              className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] px-3 py-2 text-[var(--igh-secondary)]"
            />
          </div>
          <div>
            <label htmlFor="mensagem" className="block text-sm font-medium text-[var(--igh-secondary)]">
              Mensagem *
            </label>
            <textarea
              id="mensagem"
              name="mensagem"
              rows={4}
              required
              className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] px-3 py-2 text-[var(--igh-secondary)]"
            />
            {errors.mensagem && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.mensagem}</p>}
          </div>
          {errors.form && <p className="text-sm text-red-600 dark:text-red-400">{errors.form}</p>}
          <Button type="submit" variant="primary" size="lg" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar"}
          </Button>
        </form>
      )}
    </div>
  );
}
