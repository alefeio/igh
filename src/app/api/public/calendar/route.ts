import { jsonOk } from "@/lib/http";
import { mapHolidayToPublicCalendarItems, type PublicCalendarItem } from "@/lib/public-calendar";
import { prisma } from "@/lib/prisma";
import { subtitlesMatch } from "@/lib/public-calendar-shared";

const holidaySelect = {
  id: true,
  name: true,
  date: true,
  recurring: true,
  eventStartTime: true,
  eventEndTime: true,
  allowsRegistration: true,
  publicDescription: true,
  subtitle: true,
} as const;

async function loadSubtitleTags() {
  const subtitleRows = await prisma.holiday.findMany({
    where: {
      isActive: true,
      subtitle: { not: null },
      eventStartTime: { not: null },
      eventEndTime: { not: null },
    },
    select: { subtitle: true },
  });
  return [
    ...new Set(subtitleRows.map((r) => r.subtitle?.trim()).filter((s): s is string => !!s)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function sortPublicCalendarItems(items: PublicCalendarItem[]) {
  return items.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const aStart = a.startTime ?? "";
    const bStart = b.startTime ?? "";
    if (aStart !== bStart) return aStart.localeCompare(bStart);
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subtitleParam = searchParams.get("subtitle")?.trim() || null;
  const subtitleTags = await loadSubtitleTags();

  if (subtitleParam) {
    const now = new Date();
    const rangeStart = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
    const rangeEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth() + 1, 0));

    const holidays = await prisma.holiday.findMany({
      where: {
        isActive: true,
        subtitle: { not: null },
        eventStartTime: { not: null },
        eventEndTime: { not: null },
      },
      orderBy: { date: "asc" },
      select: holidaySelect,
    });

    const matching = holidays.filter((h) => subtitlesMatch(h.subtitle, subtitleParam));
    const items: PublicCalendarItem[] = [];
    for (const h of matching) {
      items.push(...mapHolidayToPublicCalendarItems(h, rangeStart, rangeEnd));
    }

    return jsonOk({
      mode: "subtitle-list" as const,
      subtitle: subtitleParam,
      items: sortPublicCalendarItems(items),
      subtitleTags,
    });
  }

  const year = parseInt(searchParams.get("year") ?? "", 10);
  const month = parseInt(searchParams.get("month") ?? "", 10);
  const now = new Date();
  const y = Number.isFinite(year) ? year : now.getFullYear();
  const m = Number.isFinite(month) ? month : now.getMonth() + 1;

  const rangeStart = new Date(Date.UTC(y, m - 1, 1));
  const rangeEnd = new Date(Date.UTC(y, m, 0));

  const holidays = await prisma.holiday.findMany({
    where: { isActive: true },
    orderBy: { date: "asc" },
    select: holidaySelect,
  });

  const items: PublicCalendarItem[] = [];
  for (const h of holidays) {
    items.push(...mapHolidayToPublicCalendarItems(h, rangeStart, rangeEnd));
  }

  return jsonOk({
    mode: "month" as const,
    year: y,
    month: m,
    items: sortPublicCalendarItems(items),
    subtitleTags,
  });
}
