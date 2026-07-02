import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { ProfessorTurmasTabs } from "@/components/professor/ProfessorTurmasTabs";
import { requireSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ProfessorTurmasPage() {
  const user = await requireSessionUser();
  if (user.role !== "TEACHER") {
    redirect("/dashboard");
  }
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <DashboardHero
        eyebrow="Professor"
        title="Turmas que leciono"
        description="Lista de alunos, exercícios e frequência — abra cada turma para gerenciar."
      />
      <ProfessorTurmasTabs />
    </div>
  );
}
