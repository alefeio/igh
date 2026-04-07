import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { RankingAlunosFullTable, type RankingPlacementInfo } from "@/components/dashboard/RankingAlunosFullTable";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCachedStudentGamificationRankingFull } from "@/lib/cached-dashboard-queries";

export const metadata = {
  title: "Ranking de alunos | IGH",
  description: "Ranking completo de gamificação — aulas, exercícios, presença e fórum.",
};

function buildPlacement(
  student: { id: string } | null,
  fullRanking: Awaited<ReturnType<typeof getCachedStudentGamificationRankingFull>>,
  filtered: Awaited<ReturnType<typeof getCachedStudentGamificationRankingFull>>,
): RankingPlacementInfo {
  if (!student) return { kind: "not_student" };

  const viewerEntry = fullRanking.find((r) => r.studentId === student.id);
  if (!viewerEntry) return { kind: "not_in_ranking" };
  if (viewerEntry.points === 0) return { kind: "zero_points" };

  const me = filtered.find((r) => r.studentId === student.id);
  if (!me) return { kind: "not_in_ranking" };

  return {
    kind: "in_rank",
    position: me.rank,
    total: filtered.length,
    points: me.points,
  };
}

export default async function RankingAlunosPage() {
  const user = await requireSessionUser();
  const student = await prisma.student.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });

  let teacherHighlightStudentIds: string[] | null = null;
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (teacher) {
      const enrollRows = await prisma.enrollment.findMany({
        where: { status: "ACTIVE", classGroup: { teacherId: teacher.id } },
        select: { studentId: true },
      });
      teacherHighlightStudentIds = [...new Set(enrollRows.map((e) => e.studentId))];
    }
  }

  const fullRanking = await getCachedStudentGamificationRankingFull();
  const filtered = fullRanking
    .filter((r) => r.points > 0)
    .map((r, i) => ({
      ...r,
      rank: i + 1,
    }));

  const placement = buildPlacement(student, fullRanking, filtered);

  return (
    <div className="min-w-0">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--igh-primary)] hover:underline"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Voltar ao painel
        </Link>
      </div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--igh-secondary)] sm:text-3xl">
          Ranking de alunos
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
          Pontuação igual à do painel do aluno: aulas concluídas, exercícios, frequência e participação no fórum. Apenas
          alunos com matrícula ativa e com pontuação acima de zero entram na lista.
        </p>
      </header>

      <RankingAlunosFullTable
        rows={filtered}
        viewerStudentId={student?.id ?? null}
        placement={placement}
        teacherHighlightStudentIds={teacherHighlightStudentIds}
      />
    </div>
  );
}
