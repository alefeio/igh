import type { Prisma } from "@/generated/prisma/client";

import { requireStaffRead } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";
import { prisma } from "@/lib/prisma";

function brazilTodayYmd(): string {
  const d = getBrazilTodayDateOnly();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(request: Request) {
  try {
    await requireStaffRead();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "upcoming";
  const holidayId = searchParams.get("holidayId")?.trim() || null;
  const occurrenceDate = searchParams.get("occurrenceDate")?.trim() || null;
  const q = searchParams.get("q")?.trim() || null;

  const today = brazilTodayYmd();

  const where: Prisma.HolidayEventRegistrationWhereInput = {
    holiday: {
      allowsRegistration: true,
      eventStartTime: { not: null },
      eventEndTime: { not: null },
    },
  };

  if (holidayId) where.holidayId = holidayId;
  if (occurrenceDate) {
    where.occurrenceDate = occurrenceDate;
  } else if (scope === "upcoming") {
    where.occurrenceDate = { gte: today };
  } else if (scope === "past") {
    where.occurrenceDate = { lt: today };
  }

  if (q) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { user: { name: { contains: q, mode: "insensitive" } } },
          { user: { email: { contains: q, mode: "insensitive" } } },
          { holiday: { name: { contains: q, mode: "insensitive" } } },
          { holiday: { subtitle: { contains: q, mode: "insensitive" } } },
        ],
      },
    ];
  }

  const registrations = await prisma.holidayEventRegistration.findMany({
    where,
    orderBy: [{ occurrenceDate: "desc" }, { createdAt: "asc" }],
    include: {
      user: { select: { id: true, name: true, email: true } },
      holiday: {
        select: {
          id: true,
          name: true,
          subtitle: true,
          recurring: true,
          eventStartTime: true,
          eventEndTime: true,
          allowsRegistration: true,
          isActive: true,
        },
      },
    },
  });

  if (scope !== "past") {
    registrations.sort((a, b) => {
      const dateCmp = a.occurrenceDate.localeCompare(b.occurrenceDate);
      if (dateCmp !== 0) return dateCmp;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  return jsonOk({ registrations, today });
}
