/**
 * Formatação de rótulos de turma para UI (sem dependências de servidor — seguro em Client Components).
 */

const DAY_ORDER = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;

/** Abreviações em minúsculas para exibição compacta (ex.: ter e qui). */
const DAY_SHORT_PT: Record<string, string> = {
  SEG: "seg",
  TER: "ter",
  QUA: "qua",
  QUI: "qui",
  SEX: "sex",
  SAB: "sáb",
  DOM: "dom",
};

export function formatDaysShortPtBr(days: string[]): string {
  if (!days?.length) return "—";
  const sorted = [...days].sort(
    (a, b) =>
      DAY_ORDER.indexOf(a as (typeof DAY_ORDER)[number]) -
      DAY_ORDER.indexOf(b as (typeof DAY_ORDER)[number]),
  );
  const labels = sorted.map((d) => DAY_SHORT_PT[d] ?? String(d).toLowerCase());
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

export type ClassGroupTurmaParts = {
  course: { name: string } | null;
  location: string | null;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
};

export function formatClassGroupTurmaLine(cg: ClassGroupTurmaParts): string {
  const course = cg.course?.name?.trim() || "—";
  const loc = cg.location?.trim() || "—";
  const days = formatDaysShortPtBr(cg.daysOfWeek);
  const time =
    cg.startTime && cg.endTime ? `${cg.startTime}–${cg.endTime}` : "—";
  return `${course} · ${loc} · ${days} · ${time}`;
}
