"use client";

import { useState } from "react";
import { Card, Button } from "@/components/site";
import {
  SERVICE_CHANNELS,
  SERVICE_CHANNEL_LABEL,
  SERVICE_SCORE_FACES,
  formatBrazilPhoneMask,
  type ServiceChannelValue,
} from "@/lib/service-attendance";

export function AvaliacaoAtendimentoForm() {
  const [score, setScore] = useState<number | null>(null);
  const [channel, setChannel] = useState<ServiceChannelValue | "">("");
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (score == null) next.score = "Escolha uma carinha.";
    if (!channel) next.channel = "Informe onde foi o atendimento.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "E-mail inválido.";
    const digits = phone.replace(/\D/g, "");
    if (digits && (digits.length < 10 || digits.length > 11)) next.phone = "Informe o telefone com DDD.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    fetch("/api/public/avaliar-atendimento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score,
        channel,
        comment: comment.trim() || null,
        name: name.trim() || null,
        email: email.trim() || null,
        phone: digits || null,
        website,
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json?.ok !== true) {
          setErrors({ form: json?.error?.message ?? "Não foi possível enviar. Tente novamente." });
          return;
        }
        setSent(true);
      })
      .catch(() => setErrors({ form: "Não foi possível enviar. Tente novamente." }))
      .finally(() => setSubmitting(false));
  }

  if (sent) {
    return (
      <Card>
        <p className="font-medium text-[var(--igh-secondary)]">Avaliação registrada. Obrigado por ajudar a melhorar o atendimento.</p>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative space-y-6">
      <fieldset>
        <legend className="text-sm font-medium text-[var(--igh-secondary)]">Como você avalia o atendimento? *</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {SERVICE_SCORE_FACES.map((face) => {
            const selected = score === face.score;
            return (
              <button
                key={face.score}
                type="button"
                onClick={() => {
                  setScore(face.score);
                  setErrors((prev) => ({ ...prev, score: "" }));
                }}
                aria-pressed={selected}
                aria-label={`${face.label}, nota ${face.score} de 5`}
                title={face.label}
                className={`flex min-h-16 min-w-16 flex-col items-center justify-center rounded-xl border px-2 py-2 text-3xl transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] ${
                  selected
                    ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/10"
                    : "border-[var(--igh-border)] bg-[var(--card-bg)] hover:border-[var(--igh-primary)]/40"
                }`}
              >
                <span aria-hidden>{face.emoji}</span>
                <span className="mt-1 text-xs font-medium text-[var(--igh-muted)]">{face.score}</span>
              </button>
            );
          })}
        </div>
        {errors.score ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.score}</p> : null}
      </fieldset>

      <div>
        <label htmlFor="canal" className="block text-sm font-medium text-[var(--igh-secondary)]">
          Onde foi o atendimento? *
        </label>
        <select
          id="canal"
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as ServiceChannelValue | "");
            setErrors((prev) => ({ ...prev, channel: "" }));
          }}
          className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] px-3 py-2 text-[var(--igh-secondary)]"
        >
          <option value="">Selecione…</option>
          {SERVICE_CHANNELS.map((value) => (
            <option key={value} value={value}>
              {SERVICE_CHANNEL_LABEL[value]}
            </option>
          ))}
        </select>
        {errors.channel ? <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.channel}</p> : null}
      </div>

      <div>
        <label htmlFor="comentario" className="block text-sm font-medium text-[var(--igh-secondary)]">
          Comentário
        </label>
        <textarea
          id="comentario"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={4}
          className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] px-3 py-2 text-[var(--igh-secondary)]"
        />
      </div>

      <div>
        <label htmlFor="nome" className="block text-sm font-medium text-[var(--igh-secondary)]">
          Nome
        </label>
        <input
          id="nome"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          autoComplete="name"
          className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] px-3 py-2 text-[var(--igh-secondary)]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--igh-secondary)]">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] px-3 py-2 text-[var(--igh-secondary)]"
          />
          {errors.email ? <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p> : null}
        </div>
        <div>
          <label htmlFor="telefone" className="block text-sm font-medium text-[var(--igh-secondary)]">
            Telefone
          </label>
          <input
            id="telefone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(91) 98888-7777"
            value={phone}
            onChange={(e) => setPhone(formatBrazilPhoneMask(e.target.value))}
            className="mt-1 block w-full rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)] px-3 py-2 text-[var(--igh-secondary)]"
          />
          {errors.phone ? <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.phone}</p> : null}
        </div>
      </div>

      <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {errors.form ? <p className="text-sm text-red-600 dark:text-red-400">{errors.form}</p> : null}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Enviando…" : "Enviar avaliação"}
      </Button>
    </form>
  );
}
