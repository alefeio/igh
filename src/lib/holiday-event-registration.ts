import "server-only";

import { BRAND } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import { expandHolidayDateStringsInRange } from "@/lib/schedule";
import { isTimedHolidayEvent } from "@/lib/public-calendar-shared";
import { getAppUrl } from "@/lib/email";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import {
  templateHolidayEventConfirmation,
  templateHolidayEventReferralNotice,
  templateHolidayEventReminder,
} from "@/lib/email/templates";
import { holidayEventPublicPath } from "@/lib/holiday-event-slug";
import { resolveHolidayEventReferrer } from "@/lib/holiday-event-referral";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";

function brazilTodayYmd(): string {
  const d = getBrazilTodayDateOnly();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatHolidayEventLabel(
  name: string | null,
  start: string | null,
  end: string | null,
): string {
  return formatEventLabel(name, start, end);
}

function formatEventLabel(name: string | null, start: string | null, end: string | null): string {
  const label = name?.trim() || `Evento ${BRAND.shortName}`;
  if (start && end) return `${label} (${start.slice(0, 5)} – ${end.slice(0, 5)})`;
  return label;
}

export function formatHolidayEventOccurrenceDisplay(
  occurrenceDate: string,
  recurring: boolean,
): string {
  return formatOccurrenceDisplay(occurrenceDate, recurring);
}

function formatOccurrenceDisplay(occurrenceDate: string, recurring: boolean): string {
  const [y, m, d] = occurrenceDate.split("-");
  if (recurring) return `${d}/${m}`;
  return `${d}/${m}/${y}`;
}

/** Alfabeto sem caracteres ambíguos (0/O, 1/I) para o código ser ditado por telefone. */
const CHECKIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCheckinCode(): string {
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += CHECKIN_ALPHABET[Math.floor(Math.random() * CHECKIN_ALPHABET.length)];
  }
  return out;
}

/** Código único de check-in dentro da ocorrência do evento. */
async function generateCheckinCode(holidayId: string, occurrenceDate: string): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomCheckinCode();
    const clash = await prisma.holidayEventRegistration.findFirst({
      where: { holidayId, occurrenceDate, checkinCode: code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  return `${randomCheckinCode()}${Date.now().toString(36).slice(-2).toUpperCase()}`;
}

async function countRafflesForOccurrence(holidayId: string, occurrenceDate: string): Promise<number> {
  return prisma.holidayEventRaffle.count({
    where: { holidayId, occurrenceDate, status: { not: "CANCELLED" } },
  });
}

/** Verifica se ainda há vaga na ocorrência quando o evento tem capacidade definida. */
async function hasSeatAvailable(
  holiday: { id: string; capacity: number | null },
  occurrenceDate: string,
): Promise<boolean> {
  if (holiday.capacity == null || holiday.capacity <= 0) return true;
  const taken = await prisma.holidayEventRegistration.count({
    where: { holidayId: holiday.id, occurrenceDate },
  });
  return taken < holiday.capacity;
}

/** Notifica o indicador (best-effort: falha de e-mail não invalida a inscrição). */
async function notifyReferrer(params: {
  referrerUserId: string;
  participantName: string;
  eventLabel: string;
  dateLabel: string;
  eventUrl: string;
  registrationId: string;
}) {
  const referrer = await prisma.user.findFirst({
    where: { id: params.referrerUserId, isActive: true },
    select: { name: true, email: true },
  });
  if (!referrer) return;

  const { subject, html } = templateHolidayEventReferralNotice({
    referrerName: referrer.name,
    participantName: params.participantName,
    eventName: params.eventLabel,
    occurrenceDateLabel: params.dateLabel,
    eventUrl: params.eventUrl,
  });

  await sendEmailAndRecord({
    to: referrer.email,
    subject,
    html,
    emailType: "HOLIDAY_EVENT_REFERRAL_NOTICE",
    entityType: "HolidayEventRegistration",
    entityId: params.registrationId,
  });
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

export type HolidayEventReferralInput = {
  referrerUserId?: string | null;
  referrerCode?: string | null;
  referrerQuery?: string | null;
  /** Usado pelas inscrições criadas pela equipe, que não exigem indicador. */
  skipReferralRequirement?: boolean;
};

export async function registerUserForHolidayEvent(params: {
  userId: string;
  userEmail: string;
  userName: string;
  holidayId: string;
  occurrenceDate: string;
} & HolidayEventReferralInput) {
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

  const referral = await resolveHolidayEventReferrer({
    holiday,
    referrerUserId: params.referrerUserId,
    referrerCode: params.referrerCode,
    selfUserId: params.userId,
    selfEmail: params.userEmail,
    skipRequirement: params.skipReferralRequirement,
  });
  if (!referral.ok) return { ok: false as const, message: referral.message };

  if (!(await hasSeatAvailable(holiday, params.occurrenceDate))) {
    return { ok: false as const, message: "As vagas deste evento já foram preenchidas." };
  }

  const registration = await prisma.holidayEventRegistration.create({
    data: {
      holidayId: params.holidayId,
      userId: params.userId,
      occurrenceDate: params.occurrenceDate,
      checkinCode: await generateCheckinCode(params.holidayId, params.occurrenceDate),
      referrerUserId: referral.referrerUserId,
      referrerQuery: referral.referrerUserId ? params.referrerQuery?.trim() || null : null,
    },
  });

  const eventLabel = formatEventLabel(holiday.name, holiday.eventStartTime, holiday.eventEndTime);
  const dateLabel = formatOccurrenceDisplay(params.occurrenceDate, holiday.recurring);
  const eventUrl = getAppUrl(holidayEventPublicPath(holiday, params.occurrenceDate));
  const { subject, html } = templateHolidayEventConfirmation({
    name: params.userName,
    eventName: eventLabel,
    occurrenceDateLabel: dateLabel,
    startTime: holiday.eventStartTime?.slice(0, 5) ?? "",
    endTime: holiday.eventEndTime?.slice(0, 5) ?? "",
    publicDescription: holiday.publicDescription,
    eventUrl,
    checkinCode: registration.checkinCode,
    raffleCount: await countRafflesForOccurrence(params.holidayId, params.occurrenceDate),
    referrerName: referral.referrerName,
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

  if (referral.referrerUserId) {
    await notifyReferrer({
      referrerUserId: referral.referrerUserId,
      participantName: params.userName,
      eventLabel,
      dateLabel,
      eventUrl,
      registrationId: registration.id,
    });
  }

  return { ok: true as const, alreadyRegistered: false, registration };
}

export async function registerGuestForHolidayEvent(params: {
  holidayId: string;
  occurrenceDate: string;
  name: string;
  phone: string;
  email?: string | null;
  cpf?: string | null;
} & HolidayEventReferralInput) {
  const check = await validateHolidayOccurrenceDate(params.holidayId, params.occurrenceDate);
  if (!check.ok) return { ok: false as const, message: check.message };

  const { holiday } = check;
  const phone = params.phone.replace(/\D/g, "");
  const existing = await prisma.holidayEventRegistration.findFirst({
    where: {
      holidayId: params.holidayId,
      occurrenceDate: params.occurrenceDate,
      guestPhone: phone,
    },
  });
  if (existing) {
    return { ok: true as const, alreadyRegistered: true, registration: existing };
  }

  const referral = await resolveHolidayEventReferrer({
    holiday,
    referrerUserId: params.referrerUserId,
    referrerCode: params.referrerCode,
    selfEmail: params.email,
    selfPhone: phone,
    skipRequirement: params.skipReferralRequirement,
  });
  if (!referral.ok) return { ok: false as const, message: referral.message };

  if (!(await hasSeatAvailable(holiday, params.occurrenceDate))) {
    return { ok: false as const, message: "As vagas deste evento já foram preenchidas." };
  }

  const registration = await prisma.holidayEventRegistration.create({
    data: {
      holidayId: params.holidayId,
      occurrenceDate: params.occurrenceDate,
      guestName: params.name.trim(),
      guestPhone: phone,
      guestEmail: params.email?.trim().toLowerCase() || null,
      guestCpf: params.cpf?.replace(/\D/g, "") || null,
      checkinCode: await generateCheckinCode(params.holidayId, params.occurrenceDate),
      referrerUserId: referral.referrerUserId,
      referrerQuery: referral.referrerUserId ? params.referrerQuery?.trim() || null : null,
    },
  });

  const eventLabel = formatEventLabel(holiday.name, holiday.eventStartTime, holiday.eventEndTime);
  const dateLabel = formatOccurrenceDisplay(params.occurrenceDate, holiday.recurring);
  const eventUrl = getAppUrl(holidayEventPublicPath(holiday, params.occurrenceDate));

  const emailTo = registration.guestEmail;
  if (emailTo) {
    const { subject, html } = templateHolidayEventConfirmation({
      name: params.name.trim(),
      eventName: eventLabel,
      occurrenceDateLabel: dateLabel,
      startTime: holiday.eventStartTime?.slice(0, 5) ?? "",
      endTime: holiday.eventEndTime?.slice(0, 5) ?? "",
      publicDescription: holiday.publicDescription,
      eventUrl,
      checkinCode: registration.checkinCode,
      raffleCount: await countRafflesForOccurrence(params.holidayId, params.occurrenceDate),
      referrerName: referral.referrerName,
    });

    await sendEmailAndRecord({
      to: emailTo,
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
  }

  if (referral.referrerUserId) {
    await notifyReferrer({
      referrerUserId: referral.referrerUserId,
      participantName: params.name.trim(),
      eventLabel,
      dateLabel,
      eventUrl,
      registrationId: registration.id,
    });
  }

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
    const toEmail = reg.user?.email ?? reg.guestEmail ?? null;
    const toName = reg.user?.name ?? reg.guestName ?? "Participante";
    if (!toEmail) {
      skipped += 1;
      continue;
    }
    if (reg.user && !reg.user.isActive) {
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
      name: toName,
      eventName: eventLabel,
      occurrenceDateLabel: dateLabel,
      startTime: reg.holiday.eventStartTime?.slice(0, 5) ?? "",
      endTime: reg.holiday.eventEndTime?.slice(0, 5) ?? "",
      eventUrl: getAppUrl(holidayEventPublicPath(reg.holiday, reg.occurrenceDate)),
      checkinCode: reg.checkinCode,
      raffleCount: await countRafflesForOccurrence(reg.holidayId, reg.occurrenceDate),
    });

    const result = await sendEmailAndRecord({
      to: toEmail,
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
