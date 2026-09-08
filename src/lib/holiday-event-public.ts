import "server-only";

import { prisma } from "@/lib/prisma";
import { isTimedHolidayEvent } from "@/lib/public-calendar-shared";
import { dateToDateString, expandHolidayDateStringsInRange } from "@/lib/schedule";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";

export const HOLIDAY_EVENT_OCCURRENCE_WINDOW_MONTHS = 18;

export function brazilTodayYmd(): string {
  return dateToDateString(getBrazilTodayDateOnly());
}

const publicEventSelect = {
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
  requiresReferral: true,
  capacity: true,
  publicDescription: true,
  isActive: true,
  responsibleTeacher: { select: { id: true, name: true } },
} as const;

export type PublicHolidayEvent = Awaited<
  ReturnType<typeof prisma.holiday.findFirst<{ select: typeof publicEventSelect }>>
>;

/** Lista as ocorrências (YYYY-MM-DD) de um evento numa janela ampla ao redor de hoje. */
export function listHolidayEventOccurrences(holiday: {
  date: Date;
  recurring: boolean;
}): string[] {
  const today = getBrazilTodayDateOnly();
  const rangeStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - HOLIDAY_EVENT_OCCURRENCE_WINDOW_MONTHS, 1),
  );
  const rangeEnd = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + HOLIDAY_EVENT_OCCURRENCE_WINDOW_MONTHS + 1, 0),
  );
  return expandHolidayDateStringsInRange(holiday, rangeStart, rangeEnd);
}

/**
 * Resolve a ocorrência exibida: a data pedida (se for uma ocorrência válida),
 * senão a próxima futura, senão a mais recente do passado.
 */
export function resolveHolidayEventOccurrence(
  holiday: { date: Date; recurring: boolean },
  requestedDate?: string | null,
): { occurrenceDate: string | null; occurrences: string[] } {
  const occurrences = listHolidayEventOccurrences(holiday);
  if (occurrences.length === 0) return { occurrenceDate: null, occurrences };

  const requested = requestedDate?.trim();
  if (requested && occurrences.includes(requested)) {
    return { occurrenceDate: requested, occurrences };
  }

  const today = brazilTodayYmd();
  const upcoming = occurrences.find((d) => d >= today);
  return { occurrenceDate: upcoming ?? occurrences[occurrences.length - 1], occurrences };
}

/** Busca o evento pela URL pública (slug ou id, para compatibilidade com links antigos). */
export async function findPublicHolidayEventByKey(key: string) {
  const trimmed = key.trim();
  if (!trimmed) return null;

  const bySlug = await prisma.holiday.findFirst({
    where: { slug: trimmed, isActive: true },
    select: publicEventSelect,
  });
  if (bySlug) return isTimedHolidayEvent(bySlug) ? bySlug : null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (!isUuid) return null;

  const byId = await prisma.holiday.findFirst({
    where: { id: trimmed, isActive: true },
    select: publicEventSelect,
  });
  if (!byId) return null;
  return isTimedHolidayEvent(byId) ? byId : null;
}

export type PublicHolidayEventRaffle = {
  id: string;
  title: string;
  prize: string | null;
  description: string | null;
  status: string;
  drawnAt: Date | null;
  winnerNumber: number | null;
  winnerFirstName: string | null;
};

function firstName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] ?? null;
}

/** Sorteios da ocorrência, com o ganhador atual quando já houve sorteio. */
export async function listPublicHolidayEventRaffles(
  holidayId: string,
  occurrenceDate: string,
): Promise<PublicHolidayEventRaffle[]> {
  const raffles = await prisma.holidayEventRaffle.findMany({
    where: { holidayId, occurrenceDate, status: { not: "CANCELLED" } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      prize: true,
      description: true,
      status: true,
      draws: {
        where: { status: "WINNER" },
        orderBy: { drawnAt: "desc" },
        take: 1,
        select: {
          number: true,
          drawnAt: true,
          ticket: {
            select: {
              registration: {
                select: { guestName: true, user: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  return raffles.map((raffle) => {
    const draw = raffle.draws[0];
    const reg = draw?.ticket.registration;
    return {
      id: raffle.id,
      title: raffle.title,
      prize: raffle.prize,
      description: raffle.description,
      status: raffle.status,
      drawnAt: draw?.drawnAt ?? null,
      winnerNumber: draw?.number ?? null,
      winnerFirstName: draw ? firstName(reg?.user?.name ?? reg?.guestName) : null,
    };
  });
}

/** Contagem de inscritos na ocorrência (para exibir vagas restantes). */
export async function countHolidayEventRegistrations(
  holidayId: string,
  occurrenceDate: string,
): Promise<number> {
  return prisma.holidayEventRegistration.count({ where: { holidayId, occurrenceDate } });
}

/** Próximos eventos abertos, para o índice /eventos. */
export async function listUpcomingPublicHolidayEvents(limit = 24) {
  const rows = await prisma.holiday.findMany({
    where: {
      isActive: true,
      allowsRegistration: true,
      eventStartTime: { not: null },
      eventEndTime: { not: null },
    },
    orderBy: { date: "asc" },
    select: publicEventSelect,
  });

  const today = brazilTodayYmd();
  const items = rows
    .map((row) => {
      const occurrences = listHolidayEventOccurrences(row);
      const nextDate = occurrences.find((d) => d >= today) ?? null;
      return nextDate ? { event: row, occurrenceDate: nextDate } : null;
    })
    .filter((item): item is { event: (typeof rows)[number]; occurrenceDate: string } => item !== null);

  items.sort((a, b) => {
    const cmp = a.occurrenceDate.localeCompare(b.occurrenceDate);
    if (cmp !== 0) return cmp;
    return (a.event.eventStartTime ?? "").localeCompare(b.event.eventStartTime ?? "");
  });

  return items.slice(0, limit);
}
