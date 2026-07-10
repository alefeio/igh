import type { Prisma } from "@/generated/prisma/client";

import { requireStaffRead, requireStaffWrite } from "@/lib/auth";
import {
  registerGuestForHolidayEvent,
  registerUserForHolidayEvent,
  validateHolidayOccurrenceDate,
} from "@/lib/holiday-event-registration";
import { jsonErr, jsonOk } from "@/lib/http";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";
import { prisma } from "@/lib/prisma";
import { adminHolidayEventRegisterSchema } from "@/lib/validators/holiday-event-registration";

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
          { user: { whatsapp: { contains: q } } },
          { guestName: { contains: q, mode: "insensitive" } },
          { guestEmail: { contains: q, mode: "insensitive" } },
          { guestPhone: { contains: q } },
          { guestCpf: { contains: q } },
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
      user: { select: { id: true, name: true, email: true, whatsapp: true } },
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

export async function POST(request: Request) {
  try {
    await requireStaffWrite();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = adminHolidayEventRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const { holidayId, occurrenceDate, userEmail, name, phone, email, cpf } = parsed.data;

  const holidayOk = await prisma.holiday.findFirst({
    where: {
      id: holidayId,
      isActive: true,
      allowsRegistration: true,
      eventStartTime: { not: null },
      eventEndTime: { not: null },
    },
  });
  if (!holidayOk) return jsonErr("NOT_FOUND", "Evento não encontrado ou sem inscrições.", 404);

  const check = await validateHolidayOccurrenceDate(holidayId, occurrenceDate);
  const canUsePublicFlow = check.ok;

  if (userEmail) {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, name: true, email: true, isActive: true },
    });
    if (!user) {
      return jsonErr("NOT_FOUND", "Nenhum usuário encontrado com este e-mail.", 404);
    }
    if (!user.isActive) {
      return jsonErr("VALIDATION_ERROR", "Este usuário está inativo.", 400);
    }

    if (canUsePublicFlow) {
      const result = await registerUserForHolidayEvent({
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        holidayId,
        occurrenceDate,
      });
      if (!result.ok) return jsonErr("VALIDATION_ERROR", result.message, 400);
      return jsonOk(
        { registration: result.registration, alreadyRegistered: result.alreadyRegistered },
        { status: result.alreadyRegistered ? 200 : 201 },
      );
    }

    const existing = await prisma.holidayEventRegistration.findFirst({
      where: { holidayId, userId: user.id, occurrenceDate },
    });
    if (existing) {
      return jsonOk({ registration: existing, alreadyRegistered: true });
    }
    const registration = await prisma.holidayEventRegistration.create({
      data: { holidayId, userId: user.id, occurrenceDate },
    });
    return jsonOk({ registration, alreadyRegistered: false }, { status: 201 });
  }

  if (!name || !phone) {
    return jsonErr("VALIDATION_ERROR", "Informe nome e telefone.", 400);
  }

  if (canUsePublicFlow) {
    const result = await registerGuestForHolidayEvent({
      holidayId,
      occurrenceDate,
      name,
      phone,
      email,
      cpf,
    });
    if (!result.ok) return jsonErr("VALIDATION_ERROR", result.message, 400);
    return jsonOk(
      { registration: result.registration, alreadyRegistered: result.alreadyRegistered },
      { status: result.alreadyRegistered ? 200 : 201 },
    );
  }

  const phoneDigits = phone.replace(/\D/g, "");
  const existingGuest = await prisma.holidayEventRegistration.findFirst({
    where: { holidayId, occurrenceDate, guestPhone: phoneDigits },
  });
  if (existingGuest) {
    return jsonOk({ registration: existingGuest, alreadyRegistered: true });
  }

  const registration = await prisma.holidayEventRegistration.create({
    data: {
      holidayId,
      occurrenceDate,
      guestName: name.trim(),
      guestPhone: phoneDigits,
      guestEmail: email || null,
      guestCpf: cpf || null,
    },
  });
  return jsonOk({ registration, alreadyRegistered: false }, { status: 201 });
}
