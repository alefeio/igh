"use client";

import { Heart } from "lucide-react";

import type { MotherCampaignMessagePublic } from "@/lib/site-data";

import { Container } from "./Container";
import { Section } from "./Section";

export function MothersDayMessagesHomeSection({
  items,
}: {
  items: readonly MotherCampaignMessagePublic[];
}) {
  if (items.length === 0) return null;

  return (
    <Section
      title="Mensagens para as mães"
      subtitle="Trechos das declarações que nossos alunos dedicam às suas mães — orgulho e gratidão em primeiro lugar."
      background="muted"
      headerClassName="text-center"
    >
      <Container>
        <div className="mx-auto mb-8 flex max-w-2xl flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600" aria-hidden>
            <Heart className="h-7 w-7 fill-current" strokeWidth={1.5} aria-hidden />
          </div>
          <p className="text-sm leading-relaxed text-[var(--igh-muted)]">
            Cada cartão abaixo é uma mensagem enviada por um aluno na campanha especial do Dia das Mães. Os nomes são
            exibidos de forma resumida para preservar a privacidade.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((m) => (
            <figure
              key={m.id}
              className="flex h-full flex-col rounded-2xl border border-rose-200/60 bg-gradient-to-b from-white to-rose-50/80 p-5 shadow-sm dark:border-rose-900/40 dark:from-[var(--card-bg)] dark:to-rose-950/30"
            >
              <blockquote className="flex flex-1 flex-col">
                <p className="text-sm leading-relaxed text-[var(--text-primary)]">&ldquo;{m.text}&rdquo;</p>
              </blockquote>
              <figcaption className="mt-4 border-t border-rose-200/50 pt-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:text-rose-300">
                — {m.authorLabel}
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </Section>
  );
}
