import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AdminSessionsCalendar } from "@/components/dashboard/AdminSessionsCalendar";
import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { requireSessionUser } from "@/lib/auth";
import { getStudentCalendarPagePayload } from "@/lib/dashboard-data";

export const metadata = {
  title: "Calendário de aulas | Minhas turmas",
  description: "Aulas agendadas, feriados e eventos institucionais das suas turmas.",
};

export default async function MinhasTurmasCalendarioPage() {
  const user = await requireSessionUser();
  if (user.role !== "STUDENT") notFound();

  const data = await getStudentCalendarPagePayload(user.id);
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
        <span className="text-sm text-[var(--text-muted)]">Calendário de aulas</span>
      </nav>

      <DashboardHero
        eyebrow="Área do aluno"
        title="Calendário de aulas"
        description="Sessões das suas turmas ativas e datas institucionais — consulte quando precisar, sem carregar no painel inicial."
      />

      <AdminSessionsCalendar
        sessions={data.sessions}
        holidays={data.holidays}
        audience="student"
        footerHref="/minhas-turmas"
        footerLabel="Minhas turmas →"
        description="Sessões das suas turmas (abertas ou em andamento), mais feriados e eventos institucionais."
        dataTour="minhas-turmas-calendario-aulas"
      />
    </div>
  );
}
