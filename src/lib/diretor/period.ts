/** Intervalos de competência / calendário (UTC, dia civil). */

export function startOfUtcMonth(year: number, month1to12: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0, 0));
}

export function endOfUtcMonth(year: number, month1to12: number): Date {
  return new Date(Date.UTC(year, month1to12, 0, 23, 59, 59, 999));
}

export function parseCompetence(ym: string): { from: Date; to: Date; year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { from: startOfUtcMonth(year, month), to: endOfUtcMonth(year, month), year, month };
}

export function parseIsoDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
}

export function defaultCompetence(asOf = new Date()): string {
  return `${asOf.getUTCFullYear()}-${String(asOf.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function resolvePeriod(opts: {
  competence?: string;
  from?: string;
  to?: string;
  asOf?: Date;
}): { from: Date; to: Date; label: string; competence: string | null } {
  const asOf = opts.asOf ?? new Date();
  if (opts.from && opts.to) {
    const from = parseIsoDateOnly(opts.from) ?? new Date(opts.from);
    const toRaw = parseIsoDateOnly(opts.to) ?? new Date(opts.to);
    const to = new Date(toRaw);
    if (parseIsoDateOnly(opts.to)) to.setUTCHours(23, 59, 59, 999);
    return {
      from,
      to,
      label: `${opts.from} → ${opts.to}`,
      competence: null,
    };
  }
  const comp = parseCompetence(opts.competence ?? defaultCompetence(asOf));
  if (!comp) {
    const fallback = parseCompetence(defaultCompetence(asOf))!;
    return {
      from: fallback.from,
      to: fallback.to,
      label: opts.competence ?? defaultCompetence(asOf),
      competence: opts.competence ?? defaultCompetence(asOf),
    };
  }
  return {
    from: comp.from,
    to: comp.to,
    label: opts.competence ?? defaultCompetence(asOf),
    competence: `${comp.year}-${String(comp.month).padStart(2, "0")}`,
  };
}

export function addUtcDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}

export function yearBounds(year: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, 0, 1)),
    to: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}
