import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";

function brazilTodayYmd(): string {
  const d = getBrazilTodayDateOnly();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(request: Request) {
  const user = await requireRole(["TEACHER"]);
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

  const { searchParams } = new URL(request.url);
  const scope = (searchParams.get("scope") ?? "upcoming").toLowerCase(); // upcoming | past | all
  const today = brazilTodayYmd();

  const occurrenceWhere =
    scope === "past"
      ? { lt: today }
      : scope === "all"
        ? undefined
        : { gte: today };

  const grouped = await prisma.holidayEventRegistration.groupBy({
    by: ["holidayId", "occurrenceDate"],
    where: {
      ...(occurrenceWhere ? { occurrenceDate: occurrenceWhere } : {}),
      holiday: {
        isActive: true,
        allowsRegistration: true,
        responsibleTeacherId: teacher.id,
      },
    },
    _count: { _all: true },
    orderBy: [{ occurrenceDate: scope === "past" ? "desc" : "asc" }],
  });

  const holidayIds = [...new Set(grouped.map((g) => g.holidayId))];
  const holidays = holidayIds.length
    ? await prisma.holiday.findMany({
        where: { id: { in: holidayIds } },
        select: {
          id: true,
          name: true,
          subtitle: true,
          recurring: true,
          eventStartTime: true,
          eventEndTime: true,
          allowsRegistration: true,
          responsibleTeacherId: true,
        },
      })
    : [];
  const byId = new Map(holidays.map((h) => [h.id, h]));

  const occurrences = grouped
    .map((g) => {
      const h = byId.get(g.holidayId);
      if (!h) return null;
      return {
        holidayId: g.holidayId,
        occurrenceDate: g.occurrenceDate,
        registrationsCount: g._count._all,
        holiday: h,
      };
    })
    .filter(Boolean);

  return jsonOk({ teacher, today, occurrences });
}

