import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AdminSessionsCalendar } from "@/components/dashboard/AdminSessionsCalendar";
import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { requireSessionUser } from "@/lib/auth";
import { getTeacherCalendarPagePayload } from "@/lib/dashboard-data";

export const metadata = {
  title: "Calendário de aulas | Professor",
  description: "Sessões das suas turmas, feriados e eventos institucionais.",
};

export default async function ProfessorCalendarioPage() {
  const user = await requireSessionUser();
  if (user.role !== "TEACHER") notFound();

  const data = await getTeacherCalendarPagePayload(user.id);
  if (!data) notFound();

  return (
    <div className="flex min-w-0 flex-col gap-8 pb-4 sm:gap-10">
      <nav aria-label="Navegação" className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--igh-primary)] hover:underline"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Dashboard
        </Link>
        <span className="text-[var(--text-muted)]" aria-hidden>
          ·
        </span>
        <span className="text-sm text-[var(--text-muted)]">Professor</span>
      </nav>

      <DashboardHero
        eyebrow="Área do professor"
        title="Calendário de aulas"
        description="Sessões das suas turmas em aberto ou em andamento, mais feriados e eventos institucionais — carregado só quando você abre esta página."
      />

      <AdminSessionsCalendar
        sessions={data.sessions}
        holidays={data.holidays}
        audience="teacher"
        footerHref="/professor/turmas"
        footerLabel="Turmas que leciono →"
        description="Suas sessões nas turmas em aberto ou em andamento, mais feriados e eventos institucionais. Clique em um dia para ver curso, horário ou feriado/evento."
        dataTour="dashboard-calendario-aulas-professor"
      />
    </div>
  );
}
