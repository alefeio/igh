import { CalendarDays, Clock, Gift } from "lucide-react";
import type { Metadata } from "next";

import { Button, PageHeader, Section } from "@/components/site";
import { BRAND } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import { listUpcomingPublicHolidayEvents } from "@/lib/holiday-event-public";
import { holidayEventPublicPath } from "@/lib/holiday-event-slug";
import { formatHm } from "@/lib/public-calendar-shared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eventos e inscrições",
  description: `Próximos eventos abertos do ${BRAND.legalName}. Veja os detalhes e inscreva-se online.`,
};

function formatLongDate(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  });
}

export default async function EventosPage() {
  const items = await listUpcomingPublicHolidayEvents();

  const raffleCounts = new Map<string, number>();
  if (items.length > 0) {
    const grouped = await prisma.holidayEventRaffle.groupBy({
      by: ["holidayId", "occurrenceDate"],
      where: {
        status: { not: "CANCELLED" },
        OR: items.map((i) => ({ holidayId: i.event.id, occurrenceDate: i.occurrenceDate })),
      },
      _count: { _all: true },
    });
    for (const row of grouped) {
      raffleCounts.set(`${row.holidayId}|${row.occurrenceDate}`, row._count._all);
    }
  }

  return (
    <>
      <PageHeader
        title="Eventos e inscrições"
        subtitle={`Próximos eventos abertos do ${BRAND.shortName}. Clique para ver os detalhes e garantir sua vaga.`}
      />
      <Section>
        {items.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-xl border border-[var(--igh-border)] bg-[var(--igh-surface)] p-6 text-center">
            <p className="text-sm font-medium text-[var(--igh-secondary)]">
              Nenhum evento com inscrição aberta no momento.
            </p>
            <p className="mt-1 text-sm text-[var(--igh-muted)]">
              Acompanhe o calendário institucional para saber das próximas datas.
            </p>
            <Button as="link" href="/calendario" variant="outline" className="mt-4">
              Abrir calendário
            </Button>
          </div>
        ) : (
          <ul className="grid list-none gap-4 pl-0 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ event, occurrenceDate }) => {
              const raffleCount = raffleCounts.get(`${event.id}|${occurrenceDate}`) ?? 0;
              return (
                <li
                  key={`${event.id}-${occurrenceDate}`}
                  className="flex flex-col rounded-xl border border-[var(--igh-border)] bg-[var(--card-bg)] p-5 transition hover:border-[var(--igh-primary)]"
                >
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--igh-primary)]">
                    <CalendarDays className="h-4 w-4" />
                    {formatLongDate(occurrenceDate)}
                  </p>
                  <h2 className="mt-2 text-base font-semibold text-[var(--igh-secondary)]">
                    {event.name?.trim() || `Evento ${BRAND.shortName}`}
                  </h2>
                  {event.subtitle?.trim() ? (
                    <p className="mt-0.5 text-xs text-[var(--igh-muted)]">{event.subtitle}</p>
                  ) : null}
                  <p className="mt-2 flex items-center gap-2 text-xs text-[var(--igh-muted)]">
                    <Clock className="h-3.5 w-3.5" />
                    {formatHm(event.eventStartTime)} – {formatHm(event.eventEndTime)}
                  </p>
                  {event.publicDescription?.trim() ? (
                    <p className="mt-3 line-clamp-3 text-sm text-[var(--igh-muted)]">
                      {event.publicDescription.trim()}
                    </p>
                  ) : null}
                  {raffleCount > 0 ? (
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                      <Gift className="h-3.5 w-3.5" />
                      {raffleCount > 1 ? `${raffleCount} sorteios` : "1 sorteio"} para quem comparecer
                    </p>
                  ) : null}
                  <div className="mt-4 flex-1" />
                  <Button
                    as="link"
                    href={holidayEventPublicPath(event, occurrenceDate)}
                    size="sm"
                    className="w-full"
                  >
                    Ver detalhes e inscrição
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
