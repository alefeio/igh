import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  const user = await requireRole(["TEACHER"]);
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

  const { searchParams } = new URL(request.url);
  const holidayId = searchParams.get("holidayId")?.trim() || "";
  const occurrenceDate = searchParams.get("occurrenceDate")?.trim() || "";
  if (!holidayId) return jsonErr("VALIDATION_ERROR", "Informe holidayId.", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) {
    return jsonErr("VALIDATION_ERROR", "Informe occurrenceDate no formato YYYY-MM-DD.", 400);
  }

  const holiday = await prisma.holiday.findFirst({
    where: { id: holidayId, allowsRegistration: true, isActive: true, responsibleTeacherId: teacher.id },
    select: {
      id: true,
      name: true,
      subtitle: true,
      recurring: true,
      eventStartTime: true,
      eventEndTime: true,
      allowsRegistration: true,
      isActive: true,
      responsibleTeacherId: true,
    },
  });
  if (!holiday) return jsonErr("NOT_FOUND", "Evento não encontrado.", 404);

  const registrations = await prisma.holidayEventRegistration.findMany({
    where: { holidayId, occurrenceDate },
    orderBy: [{ createdAt: "asc" }],
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return jsonOk({ teacher, holiday, occurrenceDate, registrations });
}

