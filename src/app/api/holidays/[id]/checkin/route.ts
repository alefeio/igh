import { requireStaffRead } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  brazilTodayYmd,
  listHolidayEventOccurrences,
  resolveHolidayEventOccurrence,
} from "@/lib/holiday-event-public";
import { listRafflesForOccurrence } from "@/lib/holiday-event-raffle";
import { prisma } from "@/lib/prisma";
import { isTimedHolidayEvent } from "@/lib/public-calendar-shared";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffRead();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

  const { id } = await context.params;
  const holiday = await prisma.holiday.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      subtitle: true,
      slug: true,
      date: true,
      recurring: true,
      eventStartTime: true,
      eventEndTime: true,
      allowsRegistration: true,
      allowsReferral: true,
      capacity: true,
      isActive: true,
      responsibleTeacher: { select: { id: true, name: true } },
    },
  });
  if (!holiday || !isTimedHolidayEvent(holiday)) {
    return jsonErr("NOT_FOUND", "Evento não encontrado.", 404);
  }

  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("data")?.trim() ?? null;
  const { occurrenceDate } = resolveHolidayEventOccurrence(holiday, requested);
  if (!occurrenceDate) return jsonErr("NOT_FOUND", "Nenhuma ocorrência encontrada.", 404);

  const [rows, raffles] = await Promise.all([
    prisma.holidayEventRegistration.findMany({
      where: { holidayId: id, occurrenceDate },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        present: true,
        attendanceMarkedAt: true,
        checkinCode: true,
        certificateUrl: true,
        certificateFileName: true,
        guestName: true,
        guestPhone: true,
        guestEmail: true,
        guestCpf: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, whatsapp: true } },
        referrerUser: { select: { id: true, name: true } },
        raffleTicket: { select: { number: true } },
      },
    }),
    listRafflesForOccurrence(id, occurrenceDate),
  ]);

  const registrations = rows.map((r) => ({
    id: r.id,
    name: (r.user?.name ?? r.guestName ?? "Participante").trim(),
    email: r.user?.email ?? r.guestEmail ?? null,
    phone: r.user?.whatsapp ?? r.guestPhone ?? null,
    cpf: r.guestCpf,
    checkinCode: r.checkinCode,
    isGuest: !r.user,
    present: r.present,
    attendanceMarkedAt: r.attendanceMarkedAt,
    raffleNumber: r.raffleTicket?.number ?? null,
    referrerName: r.referrerUser?.name ?? null,
    certificateUrl: r.certificateUrl,
    certificateFileName: r.certificateFileName,
    createdAt: r.createdAt,
  }));

  return jsonOk({
    event: {
      id: holiday.id,
      name: holiday.name,
      subtitle: holiday.subtitle,
      slug: holiday.slug,
      recurring: holiday.recurring,
      eventStartTime: holiday.eventStartTime,
      eventEndTime: holiday.eventEndTime,
      allowsRegistration: holiday.allowsRegistration,
      allowsReferral: holiday.allowsReferral,
      capacity: holiday.capacity,
      isActive: holiday.isActive,
      responsibleTeacherName: holiday.responsibleTeacher?.name ?? null,
    },
    occurrenceDate,
    occurrences: listHolidayEventOccurrences(holiday),
    today: brazilTodayYmd(),
    registrations,
    raffles,
    stats: {
      registered: registrations.length,
      present: registrations.filter((r) => r.present === true).length,
      ticketsIssued: registrations.filter((r) => r.raffleNumber != null).length,
    },
  });
}
