import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { StudentEvolucaoPanels } from "@/components/dashboard/StudentEvolucaoPanels";
import { requireSessionUser } from "@/lib/auth";
import { getStudentEvolucaoPagePayload } from "@/lib/dashboard-data";

export const metadata = {
  title: "Evolução e engajamento | Minhas turmas",
  description: "Pontos, conquistas, ranking, desempenho em exercícios e atividade no fórum.",
};

export default async function MinhasTurmasEvolucaoPage() {
  const user = await requireSessionUser();
  if (user.role !== "STUDENT") notFound();

  const payload = await getStudentEvolucaoPagePayload(user);
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
        <span className="text-sm text-[var(--text-muted)]">Evolução e engajamento</span>
      </nav>

      <DashboardHero
        eyebrow="Área do aluno"
        title="Evolução e engajamento"
        description="Pontos, nível, conquistas, posição no ranking, desempenho nos exercícios e atalhos para o fórum — carregado só quando você abre esta página."
      />

      <StudentEvolucaoPanels
        metrics={payload.metrics}
        studentRankingTop={payload.studentRankingTop}
        myStudentRank={payload.myStudentRank}
        myStudentPoints={payload.myStudentPoints}
        forumLessonsWithActivity={payload.forumLessonsWithActivity}
      />
    </div>
  );
}
