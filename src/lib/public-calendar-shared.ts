export type PublicCalendarItem = {
  id: string;
  holidayId: string;
  date: string;
  kind: "holiday" | "event";
  name: string;
  subtitle: string | null;
  startTime: string | null;
  endTime: string | null;
  allowsRegistration: boolean;
  publicDescription: string | null;
  recurring: boolean;
};

export function isTimedHolidayEvent(row: {
  eventStartTime: string | null;
  eventEndTime: string | null;
}): boolean {
  return !!(row.eventStartTime?.trim() && row.eventEndTime?.trim());
}

export function formatPublicCalendarDate(dateStr: string, recurring: boolean): string {
  const [y, m, d] = dateStr.split("-");
  if (recurring) return `${d}/${m} (todo ano)`;
  return `${d}/${m}/${y}`;
}

export function formatHm(value: string | null): string {
  if (!value) return "";
  const s = value.trim();
  return s.length >= 5 ? s.slice(0, 5) : s;
}

export type PublicCalendarUrlState = {
  date: string | null;
  eventId: string | null;
  subtitle: string | null;
};

export function normalizeCalendarSubtitle(value: string | null | undefined): string | null {
  const s = value?.trim();
  return s ? s : null;
}

export function subtitlesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeCalendarSubtitle(a);
  const nb = normalizeCalendarSubtitle(b);
  if (!na || !nb) return false;
  return na.localeCompare(nb, "pt-BR", { sensitivity: "accent" }) === 0;
}

export function publicCalendarRegisterPath(holidayId: string, occurrenceDate: string): string {
  return buildPublicCalendarPath({ date: occurrenceDate, eventId: holidayId, subtitle: null });
}

export function buildPublicCalendarPath(state: PublicCalendarUrlState): string;
export function buildPublicCalendarPath(date?: string | null, eventId?: string | null): string;
export function buildPublicCalendarPath(
  stateOrDate?: PublicCalendarUrlState | string | null,
  eventId?: string | null
): string {
  const state: PublicCalendarUrlState =
    typeof stateOrDate === "object" && stateOrDate !== null
      ? stateOrDate
      : {
          date: typeof stateOrDate === "string" ? stateOrDate : null,
          eventId: eventId ?? null,
          subtitle: null,
        };

  const params = new URLSearchParams();
  const subtitle = normalizeCalendarSubtitle(state.subtitle);
  if (subtitle) params.set("subtitle", subtitle);
  if (state.date) params.set("date", state.date);
  if (state.date && state.eventId) params.set("event", state.eventId);
  const qs = params.toString();
  return qs ? `/calendario?${qs}` : "/calendario";
}

export function parsePublicCalendarSearchParams(
  searchParams: URLSearchParams | { get: (k: string) => string | null }
): PublicCalendarUrlState {
  const date = searchParams.get("date");
  const event = searchParams.get("event");
  const subtitle = searchParams.get("subtitle");
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const validEvent = validDate && event?.trim() ? event.trim() : null;
  return {
    date: validDate,
    eventId: validEvent,
    subtitle: normalizeCalendarSubtitle(subtitle),
  };
}

export function publicCalendarLoginPath(holidayId: string, occurrenceDate: string): string {
  return `/login?from=${encodeURIComponent(publicCalendarRegisterPath(holidayId, occurrenceDate))}`;
}

export function publicCalendarSignupPath(holidayId: string, occurrenceDate: string): string {
  return `/cadastro?from=${encodeURIComponent(publicCalendarRegisterPath(holidayId, occurrenceDate))}`;
}
