import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { TeacherAcompanhamentoPanels } from "@/components/dashboard/TeacherAcompanhamentoPanels";
import { requireSessionUser } from "@/lib/auth";
import { getTeacherAcompanhamentoPagePayload } from "@/lib/dashboard-data";

export const metadata = {
  title: "Acompanhamento | Professor",
  description: "Gamificação, engajamento por turma, ranking dos alunos, avaliações e fórum.",
};

export default async function ProfessorAcompanhamentoPage() {
  const user = await requireSessionUser();
  if (user.role !== "TEACHER") notFound();

  const payload = await getTeacherAcompanhamentoPagePayload(user);
  if (!payload) notFound();

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
        <span className="text-sm text-[var(--text-muted)]">Acompanhamento</span>
      </nav>

      <DashboardHero
        eyebrow="Área do professor"
        title="Acompanhamento completo"
        description="Gamificação, engajamento por turma, ranking dos seus alunos, avaliações e atividade no fórum — carregado só quando você abre esta página."
      />

      <TeacherAcompanhamentoPanels payload={payload} />
    </div>
  );
}
