import "server-only";

import {
  isTimedHolidayEvent,
  type PublicCalendarItem,
} from "@/lib/public-calendar-shared";
import { expandHolidayDateStringsInRange } from "@/lib/schedule";

export type { PublicCalendarItem } from "@/lib/public-calendar-shared";

export function mapHolidayToPublicCalendarItems(
  row: {
    id: string;
    name: string | null;
    subtitle: string | null;
    date: Date;
    recurring: boolean;
    eventStartTime: string | null;
    eventEndTime: string | null;
    allowsRegistration: boolean;
    publicDescription: string | null;
  },
  rangeStart: Date,
  rangeEnd: Date
): PublicCalendarItem[] {
  const timed = isTimedHolidayEvent(row);
  const label = row.name?.trim() || (timed ? "Evento" : "Feriado");
  const dateStrs = expandHolidayDateStringsInRange(row, rangeStart, rangeEnd);

  return dateStrs.map((dateStr) => ({
    id: `${row.id}-${dateStr}-${timed ? "event" : "holiday"}`,
    holidayId: row.id,
    date: dateStr,
    kind: timed ? "event" : "holiday",
    name: label,
    subtitle: timed ? row.subtitle?.trim() || null : null,
    startTime: timed ? row.eventStartTime : null,
    endTime: timed ? row.eventEndTime : null,
    allowsRegistration: timed && row.allowsRegistration,
    publicDescription: row.publicDescription,
    recurring: row.recurring,
  }));
}
