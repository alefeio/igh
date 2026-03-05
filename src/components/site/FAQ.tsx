"use client";

import { useState } from "react";
import { Section } from "./Section";

type FAQItem = { pergunta: string; resposta: string };

export function FAQ({ items, title = "Perguntas frequentes" }: { items: readonly FAQItem[]; title?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <Section title={title} background="muted">
      <div className="mx-auto max-w-3xl space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--igh-border)] bg-[var(--card-bg)]"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-4 text-left font-medium text-[var(--igh-secondary)] hover:bg-[var(--igh-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-inset rounded-lg"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              aria-expanded={openIndex === i}
            >
              {item.pergunta}
              <svg
                className={`h-5 w-5 flex-shrink-0 transition-transform ${openIndex === i ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openIndex === i && (
              <div className="border-t border-[var(--igh-border)] px-4 py-3 text-[var(--igh-muted)]">
                {item.resposta}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
