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

  let data: Awaited<ReturnType<typeof getTeacherCalendarPagePayload>> = null;
  try {
    data = await getTeacherCalendarPagePayload(user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isConnectionError =
      message.includes("connect") ||
      message.includes("upstream") ||
      message.includes("ECONNREFUSED") ||
      message.includes("connection") ||
      message.includes("Too many database connections");

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
          eyebrow="Área do professor"
          title="Calendário de aulas"
          description="Sessões das suas turmas em aberto ou em andamento, mais feriados e eventos institucionais."
        />

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
            Não foi possível carregar o calendário
          </h2>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            {isConnectionError
              ? "Falha na conexão com o banco de dados. Tente novamente em instantes."
              : "Ocorreu um erro ao buscar os dados."}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Se o problema persistir, verifique os logs do servidor.</p>
        </div>
      </div>
    );
  }

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
