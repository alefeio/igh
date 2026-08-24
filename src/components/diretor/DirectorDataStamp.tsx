"use client";

import { friendlyDataStamp } from "@/lib/diretor/ui-labels";

/** Carimbo discreto da data de referência dos dados (sem jargão técnico). */
export function DirectorDataStamp({
  dataAsOf,
  generatedAt,
}: {
  dataAsOf: string;
  generatedAt?: string;
}) {
  return <p className="text-sm text-[var(--text-muted)]">{friendlyDataStamp(dataAsOf, generatedAt)}</p>;
}
