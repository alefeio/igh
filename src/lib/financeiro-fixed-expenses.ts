/** Heurística de despesas fixas (padrões e alertas) — sem I/O. */

export type FixedExpenseSourceRow = {
  description: string;
  amountCents: number;
  entryDate: string;
  categoryId: string | null;
  categoryName: string | null;
};

export type FixedExpensePattern = {
  key: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  expectedAmountCents: number;
  lastEntryDate: string;
  monthsSeen: string[];
};

export type FixedExpenseAlert = {
  description: string;
  categoryName: string | null;
  expectedAmountCents: number | null;
  lastEntryDate: string;
  missingForMonth: string;
};

export type FixedExpenseForecastItem = {
  description: string;
  categoryName: string | null;
  expectedAmountCents: number;
};

const PT_MONTH_WORDS =
  /\b(janeiro|fevereiro|marco|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/gi;

export function normalizeFixedExpenseDescription(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b\d{4}-\d{2}(?:-\d{2})?\b/g, " ")
    .replace(/\b\d{1,2}[\/.\-]\d{2,4}\b/g, " ")
    .replace(/\b(20\d{2}|19\d{2})\b/g, " ")
    .replace(PT_MONTH_WORDS, " ")
    .replace(/\bdoc(?:umento)?\s*n?[ºo°.]?\s*\d+\b/g, " ")
    .replace(/\bnf(?:s?-?e)?\s*n?[ºo°.]?\s*\d+\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fixedExpenseKey(description: string, categoryId: string | null): string {
  const norm = normalizeFixedExpenseDescription(description);
  const fallback = description
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 48);
  return `${categoryId ?? "_"}|${norm || fallback || "despesa"}`;
}

function medianCents(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function buildFixedExpensePatterns(rows: FixedExpenseSourceRow[]): FixedExpensePattern[] {
  const groups = new Map<
    string,
    {
      description: string;
      categoryId: string | null;
      categoryName: string | null;
      amounts: number[];
      lastEntryDate: string;
      months: Set<string>;
    }
  >();

  const sorted = [...rows].sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  for (const row of sorted) {
    const key = fixedExpenseKey(row.description, row.categoryId);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        description: row.description,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        amounts: [row.amountCents],
        lastEntryDate: row.entryDate,
        months: new Set([monthOf(row.entryDate)]),
      });
      continue;
    }
    existing.amounts.push(row.amountCents);
    existing.months.add(monthOf(row.entryDate));
    if (row.entryDate > existing.lastEntryDate) {
      existing.lastEntryDate = row.entryDate;
      existing.description = row.description;
      existing.categoryName = row.categoryName;
    }
  }

  return [...groups.entries()].map(([key, g]) => ({
    key,
    description: g.description,
    categoryId: g.categoryId,
    categoryName: g.categoryName,
    expectedAmountCents: medianCents(g.amounts),
    lastEntryDate: g.lastEntryDate,
    monthsSeen: [...g.months].sort(),
  }));
}

export function findMissingFixedExpenses(
  patterns: FixedExpensePattern[],
  monthEntries: Array<{ description: string; categoryId: string | null }>,
  missingForMonth: string,
): FixedExpenseAlert[] {
  const present = new Set(monthEntries.map((e) => fixedExpenseKey(e.description, e.categoryId)));
  return patterns
    .filter((p) => !present.has(p.key))
    .sort((a, b) => a.description.localeCompare(b.description, "pt-BR"))
    .map((p) => ({
      description: p.description,
      categoryName: p.categoryName,
      expectedAmountCents: p.expectedAmountCents || null,
      lastEntryDate: p.lastEntryDate,
      missingForMonth,
    }));
}

export function forecastFromPatterns(patterns: FixedExpensePattern[]): {
  expectedCents: number;
  items: FixedExpenseForecastItem[];
} {
  const items = patterns.map((p) => ({
    description: p.description,
    categoryName: p.categoryName,
    expectedAmountCents: p.expectedAmountCents,
  }));
  return {
    expectedCents: items.reduce((sum, i) => sum + i.expectedAmountCents, 0),
    items,
  };
}

export function addCalendarMonth(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
