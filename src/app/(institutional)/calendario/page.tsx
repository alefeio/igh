import { Container, PageHeader } from "@/components/site";
import { PublicIghCalendar } from "@/components/site/PublicIghCalendar";
import { getSessionUserFromCookie } from "@/lib/auth";

export const metadata = {
  title: "Calendário IGH",
  description:
    "Feriados, eventos e inscrições do Instituto Geração Humana. Veja o calendário institucional e participe dos eventos abertos.",
};

type Props = {
  searchParams: Promise<{ event?: string; date?: string }>;
};

export default async function CalendarioPublicoPage({ searchParams }: Props) {
  const session = await getSessionUserFromCookie();
  const { event: initialHolidayId, date: initialDate } = await searchParams;

  return (
    <>
      <PageHeader
        title="Calendário IGH"
        subtitle="Feriados, eventos institucionais e inscrições abertas. Clique em um dia para ver os detalhes."
      />
      <section className="pb-16 pt-4">
        <Container>
          <PublicIghCalendar
            sessionUser={session ? { name: session.name, email: session.email, role: session.role } : null}
            initialHolidayId={initialHolidayId}
            initialDate={initialDate}
          />
        </Container>
      </section>
    </>
  );
}
