import "server-only";

const DAY_ABBREV_TO_UTC_DAY: Record<string, number> = {
  DOM: 0,
  SEG: 1,
  TER: 2,
  QUA: 3,
  QUI: 4,
  SEX: 5,
  SAB: 6,
};

function addDaysUtc(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Formato YYYY-MM-DD para comparação com feriados */
export function dateToDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SENTINEL_YEAR_RECURRING = 2000;

/** Datas (YYYY-MM-DD) em que um evento com horário bloqueia aulas que cruzem o intervalo. */
export type HolidayEventBlock = { dateStr: string; startTime: string; endTime: string };

/** Datas (YYYY-MM-DD) em que o feriado/evento cai dentro de [rangeStart, rangeEnd] (mesma regra do agendamento de turmas). */
export function expandHolidayDateStringsInRange(
  h: { date: Date | string; recurring: boolean },
  rangeStart: Date,
  rangeEnd: Date,
): string[] {
  const rangeStartStr = dateToDateString(rangeStart);
  const rangeEndStr = dateToDateString(rangeEnd);
  const startYear = rangeStart.getUTCFullYear();
  const endYear = rangeEnd.getUTCFullYear();
  return expandOneHolidayDateStrings(h, rangeStartStr, rangeEndStr, startYear, endYear);
}

function coerceUtcDate(value: Date | string): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  // Aceita ISO ou YYYY-MM-DD. Mantemos tudo em UTC para consistência com o restante do agendamento.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d));
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function expandOneHolidayDateStrings(
  h: { date: Date | string; recurring: boolean },
  rangeStartStr: string,
  rangeEndStr: string,
  startYear: number,
  endYear: number,
): string[] {
  const date = coerceUtcDate(h.date);
  if (!date) return [];
  const out: string[] = [];
  if (h.recurring) {
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    for (let y = startYear; y <= endYear; y++) {
      const d = new Date(Date.UTC(y, month, day));
      const str = dateToDateString(d);
      if (str >= rangeStartStr && str <= rangeEndStr) out.push(str);
    }
  } else {
    const str = dateToDateString(date);
    if (str >= rangeStartStr && str <= rangeEndStr) out.push(str);
  }
  return out;
}

/**
 * Separa feriados de dia inteiro e eventos com horário, no intervalo [rangeStart, rangeEnd].
 * - Dia inteiro: sem eventStartTime/eventEndTime preenchidos → lista em holidayDateStrings.
 * - Evento: com início e fim → holidayEventBlocks (só turmas cujo horário cruza o intervalo são afetadas).
 */
export function splitHolidaysForSchedule(
  holidays: { date: Date | string; recurring: boolean; eventStartTime?: string | null; eventEndTime?: string | null }[],
  rangeStart: Date,
  rangeEnd: Date,
): { holidayDateStrings: string[]; holidayEventBlocks: HolidayEventBlock[] } {
  const fullDaySet = new Set<string>();
  const blocks: HolidayEventBlock[] = [];
  const rangeStartStr = dateToDateString(rangeStart);
  const rangeEndStr = dateToDateString(rangeEnd);
  const startYear = rangeStart.getUTCFullYear();
  const endYear = rangeEnd.getUTCFullYear();

  for (const h of holidays) {
    const est = String(h.eventStartTime ?? "").trim();
    const eet = String(h.eventEndTime ?? "").trim();
    const isTimedEvent = est.length > 0 && eet.length > 0;
    const dateStrs = expandOneHolidayDateStrings(h, rangeStartStr, rangeEndStr, startYear, endYear);
    if (isTimedEvent) {
      for (const dateStr of dateStrs) {
        blocks.push({ dateStr, startTime: est, endTime: eet });
      }
    } else {
      for (const s of dateStrs) fullDaySet.add(s);
    }
  }
  return { holidayDateStrings: [...fullDaySet], holidayEventBlocks: blocks };
}

/**
 * Apenas datas de feriado de dia inteiro (sem horário de evento).
 * @deprecated Prefira splitHolidaysForSchedule quando for gerar turmas (inclui eventos por horário).
 */
export function expandHolidaysToDateStrings(
  holidays: { date: Date | string; recurring: boolean; eventStartTime?: string | null; eventEndTime?: string | null }[],
  rangeStart: Date,
  rangeEnd: Date,
): string[] {
  return splitHolidaysForSchedule(holidays, rangeStart, rangeEnd).holidayDateStrings;
}

/** Dois intervalos de horário no mesmo dia se sobrepõem (ex.: aula 08:00–10:00 e evento 08:00–11:00). */
export function intervalsOverlapSameDay(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const toM = (t: string) => {
    const parts = t.trim().split(":");
    const h = parseInt(parts[0] ?? "0", 10);
    const m = parseInt(parts[1] ?? "0", 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    return h * 60 + m;
  };
  let as = toM(aStart);
  let ae = toM(aEnd);
  let bs = toM(bStart);
  let be = toM(bEnd);
  if (ae <= as) ae += 24 * 60;
  if (be <= bs) be += 24 * 60;
  return Math.max(as, bs) < Math.min(ae, be);
}

/** Ano sentinela usado ao salvar feriado recorrente (só mês/dia importam). */
export { SENTINEL_YEAR_RECURRING };

/**
 * Parse "HH:mm" ou "H:mm" e retorna duração em horas (decimal).
 * Ex.: "19:00" e "20:15" => 1.25
 */
export function parseDurationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.trim().split(":").map((x) => parseInt(x, 10));
  const [eh, em] = endTime.trim().split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) {
    throw new Error("HORARIO_INVALIDO");
  }
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60; // atravessa meia-noite
  return (endMins - startMins) / 60;
}

export function parseDateOnly(dateStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) {
    throw new Error("DATA_INVALIDA");
  }

  return new Date(Date.UTC(year, month - 1, day));
}

export interface GenerateSessionsByWorkloadInput {
  startDate: Date;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  /** Carga horária total do curso em horas. Geração para quando total >= workloadHours. */
  workloadHours: number;
  /** Datas de feriados de dia inteiro a pular (YYYY-MM-DD). */
  holidayDateStrings: string[];
  /** Eventos com horário: só pula o dia se o horário da turma cruzar o intervalo do evento. */
  holidayEventBlocks?: HolidayEventBlock[];
}

export interface GenerateSessionsByWorkloadResult {
  dates: Date[];
  endDate: Date;
  totalHours: number;
  totalSessions: number;
}

/**
 * Gera datas de aula a partir de startDate, nos dias da semana, até atingir workloadHours.
 * Não gera aula em datas de feriado de dia inteiro; em eventos com horário, só pula se o horário
 * da turma (startTime–endTime) cruzar o intervalo do evento nesse dia.
 * Se a última aula ultrapassar levemente a carga, ainda assim é incluída (para não ficar abaixo).
 */
export function generateSessionsByWorkload(
  input: GenerateSessionsByWorkloadInput,
): GenerateSessionsByWorkloadResult {
  const {
    startDate,
    daysOfWeek,
    startTime,
    endTime,
    workloadHours,
    holidayDateStrings,
    holidayEventBlocks = [],
  } = input;

  const dayNumbers = new Set(
    daysOfWeek
      .map((d) => DAY_ABBREV_TO_UTC_DAY[d.toUpperCase()] ?? null)
      .filter((d): d is number => d !== null),
  );

  if (dayNumbers.size === 0) {
    throw new Error("DIAS_INVALIDOS");
  }

  const hoursPerSession = parseDurationHours(startTime, endTime);
  if (hoursPerSession <= 0) {
    throw new Error("HORARIO_INVALIDO");
  }

  const holidaySet = new Set(holidayDateStrings);
  const dates: Date[] = [];
  let totalHours = 0;
  const maxDays = 365 * 2; // limite de segurança: 2 anos
  let current = new Date(startDate.getTime());
  let endDate = new Date(startDate.getTime());

  function sessionBlockedOnDate(dateStr: string): boolean {
    if (holidaySet.has(dateStr)) return true;
    for (const b of holidayEventBlocks) {
      if (b.dateStr !== dateStr) continue;
      if (intervalsOverlapSameDay(startTime, endTime, b.startTime, b.endTime)) return true;
    }
    return false;
  }

  for (let i = 0; i < maxDays; i++) {
    if (totalHours >= workloadHours) break;

    const dayOfWeek = current.getUTCDay();
    const dateStr = dateToDateString(current);

    if (dayNumbers.has(dayOfWeek) && !sessionBlockedOnDate(dateStr)) {
      dates.push(new Date(current.getTime()));
      totalHours += hoursPerSession;
      endDate = new Date(current.getTime());
    }

    current = addDaysUtc(current, 1);
  }

  return {
    dates,
    endDate,
    totalHours,
    totalSessions: dates.length,
  };
}

/** Mantido para compatibilidade: gera por 8 semanas (comportamento antigo). */
interface GenerateSessionsInput {
  startDate: Date;
  daysOfWeek: string[];
  weeks?: number;
}

export function generateSessionsDates(input: GenerateSessionsInput): {
  dates: Date[];
  endDate: Date;
} {
  const { startDate, daysOfWeek, weeks = 8 } = input;

  const dayNumbers = new Set(
    daysOfWeek
      .map((d) => DAY_ABBREV_TO_UTC_DAY[d.toUpperCase()] ?? null)
      .filter((d): d is number => d !== null),
  );

  if (dayNumbers.size === 0) {
    throw new Error("DIAS_INVALIDOS");
  }

  const endDate = addDaysUtc(startDate, weeks * 7 - 1);

  const dates: Date[] = [];
  let current = new Date(startDate.getTime());

  while (current <= endDate) {
    if (dayNumbers.has(current.getUTCDay())) {
      dates.push(new Date(current.getTime()));
    }
    current = addDaysUtc(current, 1);
  }

  return { dates, endDate };
}
