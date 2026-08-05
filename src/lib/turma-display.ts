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

/** Dias ordenados em abreviação maiúscula (ex.: SEG, QUA) — selects de matrícula/reserva. */
export function formatDaysOrderedPt(days: string[] | undefined | null): string {
  const raw = Array.isArray(days) ? days : [];
  const normalized = raw
    .map((d) => String(d ?? "").trim().toUpperCase())
    .filter(Boolean);
  if (normalized.length === 0) return "";

  const unique = Array.from(new Set(normalized));
  const idx = (d: string) => {
    const i = DAY_ORDER.indexOf(d as (typeof DAY_ORDER)[number]);
    return i >= 0 ? i : 999;
  };
  const sorted = [...unique].sort((a, b) => idx(a) - idx(b) || a.localeCompare(b, "pt-BR"));
  return sorted.join(", ");
}

export const CLASS_GROUP_STATUS_LABELS: Record<string, string> = {
  PLANEJADA: "Planejada",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
};

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

/** Rótulo completo do `<option>` de turma nos modais Nova matrícula / Cadastro de reserva. */
export type EnrollmentClassGroupOptionParts = {
  course: { name: string };
  status?: string | null;
  isExternal?: boolean | null;
  startDate: string;
  startTime: string;
  endTime: string;
  daysOfWeek?: string[] | null;
  location?: string | null;
  capacity?: number | null;
  enrollmentsCount?: number | null;
};

export function formatEnrollmentClassGroupOptionLabel(
  cg: EnrollmentClassGroupOptionParts,
  formatDateOnly: (iso: string) => string,
): string {
  const cap = cg.capacity ?? 0;
  const count = cg.enrollmentsCount ?? 0;
  const isFull = cap > 0 && count >= cap;
  const label = [
    cg.course.name,
    CLASS_GROUP_STATUS_LABELS[cg.status ?? ""] ?? cg.status,
    cg.isExternal ? "Externa" : null,
    `Início ${formatDateOnly(cg.startDate)}`,
    `${cg.startTime}-${cg.endTime}`,
    Array.isArray(cg.daysOfWeek) && cg.daysOfWeek.length ? formatDaysOrderedPt(cg.daysOfWeek) : null,
    cg.location || null,
  ]
    .filter(Boolean)
    .join(" — ");
  return `${label} — (${count} / ${cap || "—"} vagas)${isFull ? " — Lotada" : ""}`;
}
