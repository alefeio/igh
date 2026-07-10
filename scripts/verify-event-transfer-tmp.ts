import "../prisma/load-env";
import { prisma } from "../src/lib/prisma";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  for (const day of ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16"]) {
    const events = await prisma.holiday.findMany({
      where: {
        eventStartTime: { not: null },
        eventEndTime: { not: null },
        date: {
          gte: new Date(day + "T00:00:00.000Z"),
          lte: new Date(day + "T23:59:59.999Z"),
        },
      },
      select: {
        id: true,
        name: true,
        subtitle: true,
        eventStartTime: true,
        eventEndTime: true,
        _count: { select: { registrations: true } },
      },
      orderBy: [{ eventStartTime: "asc" }, { name: "asc" }],
    });
    const regs = await prisma.holidayEventRegistration.count({ where: { occurrenceDate: day } });
    console.log(`${day}: events=${events.length} regs_by_occurrence=${regs}`);
    for (const e of events) {
      console.log(
        `  ${e.name || ""} | ${e.subtitle || ""} | ${e.eventStartTime || ""}-${e.eventEndTime || ""} | regs=${e._count.registrations}`,
      );
    }
  }
}

main().finally(() => prisma.$disconnect());
