import { jsonOk } from "@/lib/http";
import { mapHolidayToPublicCalendarItems, type PublicCalendarItem } from "@/lib/public-calendar";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
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
    select: {
      id: true,
      name: true,
      date: true,
      recurring: true,
      eventStartTime: true,
      eventEndTime: true,
      allowsRegistration: true,
      publicDescription: true,
      subtitle: true,
    },
  });

  const items: PublicCalendarItem[] = [];
  for (const h of holidays) {
    items.push(...mapHolidayToPublicCalendarItems(h, rangeStart, rangeEnd));
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

  const subtitleRows = await prisma.holiday.findMany({
    where: {
      isActive: true,
      subtitle: { not: null },
      eventStartTime: { not: null },
      eventEndTime: { not: null },
    },
    select: { subtitle: true },
  });
  const subtitleTags = [
    ...new Set(
      subtitleRows
        .map((r) => r.subtitle?.trim())
        .filter((s): s is string => !!s)
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return jsonOk({ year: y, month: m, items, subtitleTags });
}
