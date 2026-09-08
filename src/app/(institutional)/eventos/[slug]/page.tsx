import { CalendarDays, Clock, Gift, MapPin, Trophy, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button, Container, PageHeader, Section } from "@/components/site";
import { getSessionUserFromCookie } from "@/lib/auth";
import { getTurnstileSiteKey } from "@/lib/bot-protection";
import { BRAND } from "@/lib/brand";
import { getAppUrl } from "@/lib/email";
import {
  brazilTodayYmd,
  countHolidayEventRegistrations,
  findPublicHolidayEventByKey,
  listPublicHolidayEventRaffles,
  resolveHolidayEventOccurrence,
} from "@/lib/holiday-event-public";
import { describeReferrerByCode } from "@/lib/holiday-event-referral";
import { holidayEventPublicPath } from "@/lib/holiday-event-slug";
import { formatHm, formatPublicCalendarDate } from "@/lib/public-calendar-shared";
import { ensureUserReferralCode } from "@/lib/student-referrals";

import { EventRegistrationPanel } from "./EventRegistrationPanel";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ data?: string; ref?: string }>;
};

function normalizeDateParam(value: string | undefined): string | null {
  const v = value?.trim();
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function formatLongDate(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await findPublicHolidayEventByKey(slug);
  if (!event) {
    return { title: "Evento não encontrado" };
  }

  const raw = await searchParams;
  const { occurrenceDate } = resolveHolidayEventOccurrence(event, normalizeDateParam(raw.data));
  const name = event.name?.trim() || `Evento ${BRAND.shortName}`;
  const dateLabel = occurrenceDate ? formatLongDate(occurrenceDate) : null;
  const description =
    event.publicDescription?.trim() ||
    event.subtitle?.trim() ||
    `${name}${dateLabel ? ` — ${dateLabel}` : ""}. Inscreva-se pelo site do ${BRAND.legalName}.`;
  const url = getAppUrl(holidayEventPublicPath(event, occurrenceDate));

  return {
    title: name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: name,
      description,
      url,
      siteName: BRAND.legalName,
    },
    twitter: { card: "summary_large_image", title: name, description },
  };
}

export default async function EventoPublicoPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const event = await findPublicHolidayEventByKey(slug);
  if (!event) notFound();

  const raw = await searchParams;
  const { occurrenceDate, occurrences } = resolveHolidayEventOccurrence(
    event,
    normalizeDateParam(raw.data),
  );
  if (!occurrenceDate) notFound();

  const today = brazilTodayYmd();
  const isPast = occurrenceDate < today;
  const eventPath = holidayEventPublicPath(event, occurrenceDate);

  const [session, raffles, registrationCount] = await Promise.all([
    getSessionUserFromCookie(),
    listPublicHolidayEventRaffles(event.id, occurrenceDate),
    countHolidayEventRegistrations(event.id, occurrenceDate),
  ]);

  const referralCode = raw.ref?.trim() || null;
  const initialReferrer =
    event.allowsReferral && referralCode ? await describeReferrerByCode(referralCode) : null;

  const myReferralLink =
    event.allowsReferral && session?.isActive
      ? getAppUrl(`${eventPath}&ref=${await ensureUserReferralCode(session.id)}`)
      : null;

  const seatsLeft =
    event.capacity != null && event.capacity > 0
      ? Math.max(0, event.capacity - registrationCount)
      : null;

  const eventName = event.name?.trim() || `Evento ${BRAND.shortName}`;
  const upcomingOccurrences = occurrences.filter((d) => d >= today && d !== occurrenceDate).slice(0, 6);
  const drawnRaffles = raffles.filter((r) => r.winnerNumber != null);

  return (
    <>
      <PageHeader
        title={eventName}
        subtitle={event.subtitle?.trim() || undefined}
        compact
      />
      <Section>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
          <div>
            <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-[var(--igh-border)] bg-[var(--igh-surface)] p-4 text-sm">
              <p className="flex items-center gap-2 font-medium capitalize text-[var(--igh-secondary)]">
                <CalendarDays className="h-4 w-4 text-[var(--igh-primary)]" />
                {formatLongDate(occurrenceDate)}
              </p>
              <p className="flex items-center gap-2 text-[var(--igh-muted)]">
                <Clock className="h-4 w-4 text-[var(--igh-primary)]" />
                {formatHm(event.eventStartTime)} – {formatHm(event.eventEndTime)}
              </p>
              {event.responsibleTeacher ? (
                <p className="flex items-center gap-2 text-[var(--igh-muted)]">
                  <UserCheck className="h-4 w-4 text-[var(--igh-primary)]" />
                  {event.responsibleTeacher.name}
                </p>
              ) : null}
              <p className="flex items-center gap-2 text-[var(--igh-muted)]">
                <MapPin className="h-4 w-4 text-[var(--igh-primary)]" />
                {BRAND.shortName}
              </p>
            </div>

            {event.publicDescription?.trim() ? (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-[var(--igh-secondary)]">Sobre o evento</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--igh-muted)]">
                  {event.publicDescription.trim()}
                </p>
              </div>
            ) : null}

            {raffles.length > 0 ? (
              <div className="mt-8">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--igh-secondary)]">
                  <Gift className="h-5 w-5 text-[var(--igh-accent)]" />
                  {raffles.length > 1 ? "Sorteios deste evento" : "Sorteio deste evento"}
                </h2>
                <p className="mt-1 text-sm text-[var(--igh-muted)]">
                  Realizados no dia, apenas entre os participantes com presença confirmada no local.
                </p>
                <ul className="mt-4 flex list-none flex-col gap-3 pl-0">
                  {raffles.map((raffle) => (
                    <li
                      key={raffle.id}
                      className="rounded-xl border border-[var(--igh-border)] bg-[var(--card-bg)] p-4"
                    >
                      <p className="text-sm font-semibold text-[var(--igh-secondary)]">
                        {raffle.title}
                      </p>
                      {raffle.prize?.trim() ? (
                        <p className="mt-0.5 text-sm text-[var(--igh-primary)]">{raffle.prize}</p>
                      ) : null}
                      {raffle.description?.trim() ? (
                        <p className="mt-1 text-xs text-[var(--igh-muted)]">{raffle.description}</p>
                      ) : null}
                      {raffle.winnerNumber != null ? (
                        <p className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
                          <Trophy className="h-4 w-4" />
                          Número {raffle.winnerNumber}
                          {raffle.winnerFirstName ? ` — ${raffle.winnerFirstName}` : ""}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-[var(--igh-muted)]">
                          Sorteio ainda não realizado.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {upcomingOccurrences.length > 0 ? (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-[var(--igh-secondary)]">Outras datas</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {upcomingOccurrences.map((date) => (
                    <a
                      key={date}
                      href={holidayEventPublicPath(event, date)}
                      className="rounded-full border border-[var(--igh-border)] px-3 py-1.5 text-xs font-medium text-[var(--igh-secondary)] transition hover:border-[var(--igh-primary)] hover:text-[var(--igh-primary)]"
                    >
                      {formatPublicCalendarDate(date, false)}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
            <EventRegistrationPanel
              holidayId={event.id}
              occurrenceDate={occurrenceDate}
              eventPath={eventPath}
              allowsRegistration={event.allowsRegistration}
              allowsReferral={event.allowsReferral}
              requiresReferral={event.requiresReferral}
              isPast={isPast}
              seatsLeft={seatsLeft}
              raffleCount={raffles.length}
              isLoggedIn={!!session?.isActive}
              turnstileSiteKey={getTurnstileSiteKey()}
              initialReferrer={initialReferrer}
              referralCode={referralCode}
              myReferralLink={myReferralLink}
            />

            <div className="rounded-xl border border-[var(--igh-border)] bg-[var(--igh-surface)] p-5 text-sm text-[var(--igh-muted)]">
              <h2 className="text-base font-semibold text-[var(--igh-secondary)]">
                Como funciona no dia
              </h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>Faça a inscrição aqui e guarde o código de check-in que chega por e-mail.</li>
                <li>No dia, apresente o código à equipe para confirmarmos a sua presença.</li>
                {raffles.length > 0 ? (
                  <li>
                    Com a presença confirmada, você recebe um número válido para todos os sorteios do
                    evento.
                  </li>
                ) : null}
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  as="link"
                  href={`/api/public/holiday-events/${event.id}/ics?data=${occurrenceDate}`}
                  variant="outline"
                  size="sm"
                >
                  Adicionar ao calendário
                </Button>
                <Button as="link" href="/eventos" variant="outline" size="sm">
                  Outros eventos
                </Button>
              </div>
            </div>
          </aside>
        </div>

        {drawnRaffles.length > 0 && isPast ? (
          <Container className="!px-0">
            <p className="mt-10 text-center text-xs text-[var(--igh-muted)]">
              Resultados divulgados com o primeiro nome do ganhador e o número sorteado, preservando os
              demais dados pessoais.
            </p>
          </Container>
        ) : null}
      </Section>
    </>
  );
}
