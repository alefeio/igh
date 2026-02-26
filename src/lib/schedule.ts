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

/**
 * Expande lista de feriados (recorrentes e específicos) para um conjunto de
 * strings YYYY-MM-DD no intervalo [rangeStart, rangeEnd].
 * - recurring: repete o mesmo mês/dia em cada ano do intervalo.
 * - !recurring: inclui a data exata se estiver no intervalo.
 */
export function expandHolidaysToDateStrings(
  holidays: { date: Date; recurring: boolean }[],
  rangeStart: Date,
  rangeEnd: Date
): string[] {
  const set = new Set<string>();
  const startYear = rangeStart.getUTCFullYear();
  const endYear = rangeEnd.getUTCFullYear();
  const rangeStartStr = dateToDateString(rangeStart);
  const rangeEndStr = dateToDateString(rangeEnd);

  for (const h of holidays) {
    if (h.recurring) {
      const month = h.date.getUTCMonth();
      const day = h.date.getUTCDate();
      for (let y = startYear; y <= endYear; y++) {
        const d = new Date(Date.UTC(y, month, day));
        const str = dateToDateString(d);
        if (str >= rangeStartStr && str <= rangeEndStr) set.add(str);
      }
    } else {
      const str = dateToDateString(h.date);
      if (str >= rangeStartStr && str <= rangeEndStr) set.add(str);
    }
  }
  return [...set];
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
  /** Datas de feriados a pular (YYYY-MM-DD). */
  holidayDateStrings: string[];
}

export interface GenerateSessionsByWorkloadResult {
  dates: Date[];
  endDate: Date;
  totalHours: number;
  totalSessions: number;
}

/**
 * Gera datas de aula a partir de startDate, nos dias da semana, até atingir workloadHours.
 * Não gera aula em datas que estejam em holidayDateStrings.
 * Se a última aula ultrapassar levemente a carga, ainda assim é incluída (para não ficar abaixo).
 */
export function generateSessionsByWorkload(
  input: GenerateSessionsByWorkloadInput,
): GenerateSessionsByWorkloadResult {
  const { startDate, daysOfWeek, startTime, endTime, workloadHours, holidayDateStrings } = input;

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

  for (let i = 0; i < maxDays; i++) {
    if (totalHours >= workloadHours) break;

    const dayOfWeek = current.getUTCDay();
    const dateStr = dateToDateString(current);

    if (dayNumbers.has(dayOfWeek) && !holidaySet.has(dateStr)) {
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
