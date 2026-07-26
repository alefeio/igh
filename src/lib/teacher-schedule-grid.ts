/** Apoio ao quadro de horários por professor. */

export type ScheduleSlot = {
  id: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
};

export const DAY_ORDER = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;

/** Minutos desde 00:00; `null` quando o horário não está no formato HH:mm. */
export function timeToMinutes(hhmm: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Ordena turmas pelo primeiro dia da semana e, dentro dele, pelo horário de início. */
export function compareBySchedule(a: ScheduleSlot, b: ScheduleSlot): number {
  const dayIndex = (slot: ScheduleSlot) => {
    const indexes = slot.daysOfWeek
      .map((d) => DAY_ORDER.indexOf(d as (typeof DAY_ORDER)[number]))
      .filter((i) => i >= 0);
    return indexes.length > 0 ? Math.min(...indexes) : Number.MAX_SAFE_INTEGER;
  };
  const byDay = dayIndex(a) - dayIndex(b);
  if (byDay !== 0) return byDay;
  return (timeToMinutes(a.startTime) ?? 0) - (timeToMinutes(b.startTime) ?? 0);
}
