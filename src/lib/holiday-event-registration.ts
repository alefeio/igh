import "server-only";

import { prisma } from "@/lib/prisma";
import { expandHolidayDateStringsInRange } from "@/lib/schedule";
import { isTimedHolidayEvent } from "@/lib/public-calendar-shared";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import {
  templateHolidayEventConfirmation,
  templateHolidayEventReminder,
} from "@/lib/email/templates";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";

function brazilTodayYmd(): string {
  const d = getBrazilTodayDateOnly();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatEventLabel(name: string | null, start: string | null, end: string | null): string {
  const label = name?.trim() || "Evento IGH";
  if (start && end) return `${label} (${start.slice(0, 5)} – ${end.slice(0, 5)})`;
  return label;
}

function formatOccurrenceDisplay(occurrenceDate: string, recurring: boolean): string {
  const [y, m, d] = occurrenceDate.split("-");
  if (recurring) return `${d}/${m}`;
  return `${d}/${m}/${y}`;
}

export async function validateHolidayOccurrenceDate(holidayId: string, occurrenceDate: string): Promise<
  | { ok: true; holiday: NonNullable<Awaited<ReturnType<typeof prisma.holiday.findFirst>>> }
  | { ok: false; message: string }
> {
  const holiday = await prisma.holiday.findFirst({
    where: { id: holidayId, isActive: true },
  });
  if (!holiday) return { ok: false, message: "Evento não encontrado." };
  if (!isTimedHolidayEvent(holiday)) {
    return { ok: false, message: "Apenas eventos com horário aceitam inscrição." };
  }
  if (!holiday.allowsRegistration) {
    return { ok: false, message: "Este evento não está aberto para inscrições." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) {
    return { ok: false, message: "Data da ocorrência inválida." };
  }

  const probe = new Date(occurrenceDate + "T12:00:00.000Z");
  const dates = expandHolidayDateStringsInRange(holiday, probe, probe);
  if (!dates.includes(occurrenceDate)) {
    return { ok: false, message: "Data não corresponde a este evento." };
  }

  const today = brazilTodayYmd();
  if (occurrenceDate < today) {
    return { ok: false, message: "Não é possível se inscrever em eventos passados." };
  }

  return { ok: true, holiday };
}

export async function registerUserForHolidayEvent(params: {
  userId: string;
  userEmail: string;
  userName: string;
  holidayId: string;
  occurrenceDate: string;
}) {
  const check = await validateHolidayOccurrenceDate(params.holidayId, params.occurrenceDate);
  if (!check.ok) return { ok: false as const, message: check.message };

  const { holiday } = check;
  const existing = await prisma.holidayEventRegistration.findUnique({
    where: {
      holidayId_userId_occurrenceDate: {
        holidayId: params.holidayId,
        userId: params.userId,
        occurrenceDate: params.occurrenceDate,
      },
    },
  });
  if (existing) {
    return { ok: true as const, alreadyRegistered: true, registration: existing };
  }

  const registration = await prisma.holidayEventRegistration.create({
    data: {
      holidayId: params.holidayId,
      userId: params.userId,
      occurrenceDate: params.occurrenceDate,
    },
  });

  const eventLabel = formatEventLabel(holiday.name, holiday.eventStartTime, holiday.eventEndTime);
  const dateLabel = formatOccurrenceDisplay(params.occurrenceDate, holiday.recurring);
  const { subject, html } = templateHolidayEventConfirmation({
    name: params.userName,
    eventName: eventLabel,
    occurrenceDateLabel: dateLabel,
    startTime: holiday.eventStartTime?.slice(0, 5) ?? "",
    endTime: holiday.eventEndTime?.slice(0, 5) ?? "",
    publicDescription: holiday.publicDescription,
  });

  await sendEmailAndRecord({
    to: params.userEmail,
    subject,
    html,
    emailType: "HOLIDAY_EVENT_CONFIRMATION",
    entityType: "HolidayEventRegistration",
    entityId: registration.id,
  });

  await prisma.holidayEventRegistration.update({
    where: { id: registration.id },
    data: { confirmationEmailSentAt: new Date() },
  });

  return { ok: true as const, alreadyRegistered: false, registration };
}

export type HolidayEventReminderRunResult = {
  date: string;
  sent: number;
  skipped: number;
  failed: number;
};

/** Lembretes no dia do evento (~6h BRT / 9h UTC via cron). */
export async function runHolidayEventRemindersForToday(): Promise<HolidayEventReminderRunResult> {
  const today = brazilTodayYmd();

  const registrations = await prisma.holidayEventRegistration.findMany({
    where: {
      occurrenceDate: today,
      reminderEmailSentAt: null,
      holiday: { isActive: true, allowsRegistration: true },
    },
    include: {
      holiday: true,
      user: { select: { id: true, name: true, email: true, isActive: true } },
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const reg of registrations) {
    if (!reg.user.isActive) {
      skipped += 1;
      continue;
    }

    const prior = await prisma.sentEmail.findFirst({
      where: {
        emailType: "HOLIDAY_EVENT_REMINDER",
        entityType: "HolidayEventRegistration",
        entityId: reg.id,
      },
      select: { id: true },
    });
    if (prior) {
      await prisma.holidayEventRegistration.update({
        where: { id: reg.id },
        data: { reminderEmailSentAt: new Date() },
      });
      skipped += 1;
      continue;
    }

    const eventLabel = formatEventLabel(reg.holiday.name, reg.holiday.eventStartTime, reg.holiday.eventEndTime);
    const dateLabel = formatOccurrenceDisplay(reg.occurrenceDate, reg.holiday.recurring);
    const { subject, html } = templateHolidayEventReminder({
      name: reg.user.name,
      eventName: eventLabel,
      occurrenceDateLabel: dateLabel,
      startTime: reg.holiday.eventStartTime?.slice(0, 5) ?? "",
      endTime: reg.holiday.eventEndTime?.slice(0, 5) ?? "",
    });

    const result = await sendEmailAndRecord({
      to: reg.user.email,
      subject,
      html,
      emailType: "HOLIDAY_EVENT_REMINDER",
      entityType: "HolidayEventRegistration",
      entityId: reg.id,
    });

    if (result.success) {
      await prisma.holidayEventRegistration.update({
        where: { id: reg.id },
        data: { reminderEmailSentAt: new Date() },
      });
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return { date: today, sent, skipped, failed };
}
