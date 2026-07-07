export type PublicCalendarItem = {
  id: string;
  holidayId: string;
  date: string;
  kind: "holiday" | "event";
  name: string;
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

export function publicCalendarRegisterPath(holidayId: string, occurrenceDate: string): string {
  const params = new URLSearchParams({ event: holidayId, date: occurrenceDate });
  return `/calendario?${params.toString()}`;
}

export function publicCalendarLoginPath(holidayId: string, occurrenceDate: string): string {
  return `/login?from=${encodeURIComponent(publicCalendarRegisterPath(holidayId, occurrenceDate))}`;
}

export function publicCalendarSignupPath(holidayId: string, occurrenceDate: string): string {
  return `/cadastro?from=${encodeURIComponent(publicCalendarRegisterPath(holidayId, occurrenceDate))}`;
}
