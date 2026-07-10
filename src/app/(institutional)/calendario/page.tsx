import { Suspense } from "react";

import { Container, PageHeader } from "@/components/site";
import { PublicCalendarHighlightBanner } from "@/components/site/PublicCalendarHighlightBanner";
import { PublicIghCalendar } from "@/components/site/PublicIghCalendar";
import { getSessionUserFromCookie } from "@/lib/auth";
import { getTurnstileSiteKey } from "@/lib/bot-protection";
import { getActiveHolidayCalendarBanner } from "@/lib/holiday-calendar-banner";
import { parsePublicCalendarSearchParams } from "@/lib/public-calendar-shared";

export const metadata = {
  title: "Calendário IGH",
  description:
    "Feriados, eventos e inscrições do Instituto Geração Humana. Veja o calendário institucional e participe dos eventos abertos.",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ event?: string; date?: string; subtitle?: string }>;
};

export default async function CalendarioPublicoPage({ searchParams }: Props) {
  const session = await getSessionUserFromCookie();
  const raw = await searchParams;
  const { date: initialDate, eventId: initialHolidayId } = parsePublicCalendarSearchParams({
    get: (key) =>
      key === "date" ? raw.date ?? null : key === "event" ? raw.event ?? null : key === "subtitle" ? raw.subtitle ?? null : null,
  });
  const banner = await getActiveHolidayCalendarBanner();

  return (
    <>
      <PageHeader
        title="Calendário IGH"
        subtitle="Feriados, eventos institucionais e inscrições abertas. Clique em um dia para ver os detalhes."
      />
      <section className="pb-16 pt-4">
        <Container>
          <PublicCalendarHighlightBanner banner={banner} />
          <Suspense fallback={<p className="text-sm text-[var(--igh-muted)]">Carregando calendário…</p>}>
            <PublicIghCalendar
              sessionUser={session ? { name: session.name, email: session.email, role: session.role } : null}
              initialHolidayId={initialHolidayId ?? undefined}
              initialDate={initialDate ?? undefined}
              turnstileSiteKey={getTurnstileSiteKey()}
            />
          </Suspense>
        </Container>
      </section>
    </>
  );
}
