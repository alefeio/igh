"use client";

import { useState } from "react";
import { Card, Button } from "@/components/site";

export function ContatoForm() {
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const nome = (data.get("nome") as string)?.trim();
    const email = (data.get("email") as string)?.trim();
    const telefone = (data.get("telefone") as string)?.trim();
    const assunto = (data.get("assunto") as string)?.trim();
    const mensagem = (data.get("mensagem") as string)?.trim();

    const next: Record<string, string> = {};
    if (!nome) next.nome = "Informe seu nome.";
    if (!email) next.email = "Informe seu e-mail.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "E-mail inválido.";
    if (!assunto) next.assunto = "Informe o assunto.";
    if (!mensagem) next.mensagem = "Informe a mensagem.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSent(true);
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
            <label htmlFor="nome" className="block text-sm font-medium text-[var(--igh-secondary)]">Nome</label>
            <input id="nome" name="nome" type="text" className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] px-3 py-2 text-[var(--igh-secondary)]" />
            {errors.nome && <p className="mt-1 text-sm text-red-600">{errors.nome}</p>}
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--igh-secondary)]">E-mail</label>
            <input id="email" name="email" type="email" className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] px-3 py-2" />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="telefone" className="block text-sm font-medium text-[var(--igh-secondary)]">Telefone / WhatsApp</label>
            <input id="telefone" name="telefone" type="tel" inputMode="numeric" autoComplete="tel" className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] px-3 py-2" />
          </div>
          <div>
            <label htmlFor="assunto" className="block text-sm font-medium text-[var(--igh-secondary)]">Assunto</label>
            <input id="assunto" name="assunto" type="text" className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] px-3 py-2" />
            {errors.assunto && <p className="mt-1 text-sm text-red-600">{errors.assunto}</p>}
          </div>
          <div>
            <label htmlFor="mensagem" className="block text-sm font-medium text-[var(--igh-secondary)]">Mensagem</label>
            <textarea id="mensagem" name="mensagem" rows={4} className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] px-3 py-2" />
            {errors.mensagem && <p className="mt-1 text-sm text-red-600">{errors.mensagem}</p>}
          </div>
          <Button type="submit" variant="primary" size="lg">Enviar</Button>
        </form>
      )}
    </div>
  );
}
