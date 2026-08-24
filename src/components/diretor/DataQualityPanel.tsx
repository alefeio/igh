"use client";

import { useState } from "react";

import { domainLabel, qualityStatusLabel } from "@/lib/diretor/ui-labels";

export function DataQualityPanel({
  items,
}: {
  items: Array<{ domain?: string; title?: string; fact?: string; status?: string; note?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const incomplete = items.filter((i) => i.status !== "ok" || i.fact || i.note);
  if (incomplete.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 text-sm">
      <p>
        Alguns indicadores possuem dados incompletos.{" "}
        <button type="button" className="font-semibold text-[var(--igh-primary)] underline" onClick={() => setOpen((v) => !v)}>
          {open ? "Ocultar detalhes" : "Ver detalhes"}
        </button>
      </p>
      {open ? (
        <ul className="mt-3 space-y-2">
          {incomplete.map((i, idx) => (
            <li key={`${i.domain}-${idx}`}>
              <strong>{i.title || domainLabel(i.domain ?? "")}</strong>
              {i.status ? ` — ${qualityStatusLabel(i.status)}` : ""}
              <p className="text-[var(--text-muted)]">{i.fact || i.note || "Há lacunas neste tema."}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
