import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AdminSessionsCalendar } from "@/components/dashboard/AdminSessionsCalendar";
import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { requireSessionUser } from "@/lib/auth";
import { getAdminCalendarPagePayload } from "@/lib/dashboard-data";

export const metadata = {
  title: "Calendário institucional | Admin",
  description: "Sessões de turmas em aberto ou em andamento, feriados e eventos.",
};

export default async function AdminCalendarioPage() {
  const user = await requireSessionUser();
  if (user.role !== "ADMIN" && user.role !== "MASTER" && user.role !== "COORDINATOR") {
    notFound();
  }

  const data = await getAdminCalendarPagePayload();

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
        <span className="text-sm text-[var(--text-muted)]">Calendário institucional</span>
      </nav>

      <DashboardHero
        eyebrow="Painel administrativo"
        title="Calendário institucional"
        description="Todas as sessões agendadas no período (turmas abertas ou em andamento), mais feriados e eventos — carregado só quando você abre esta página."
      />

      <AdminSessionsCalendar
        sessions={data.sessions}
        holidays={data.holidays}
        footerHref="/class-groups"
        footerLabel="Gerir turmas →"
        dataTour="admin-calendario-institucional"
      />
    </div>
  );
}
