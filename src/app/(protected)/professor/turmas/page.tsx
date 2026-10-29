import { DashboardHero } from "@/components/dashboard/DashboardUI";
import { ProfessorTurmasTabs } from "@/components/professor/ProfessorTurmasTabs";
import { requireSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ProfessorTurmasPage({ searchParams }: { searchParams: Promise<{ buscaAtiva?: string }> }) {
  const user = await requireSessionUser();
  const isPedagogicalAdmin = user.role === "ADMIN";
  if (user.role !== "TEACHER" && !isPedagogicalAdmin) {
    redirect("/dashboard");
  }
  if (!isPedagogicalAdmin) {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      redirect("/dashboard");
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      {(await searchParams).buscaAtiva === "abrirTurma" && !isPedagogicalAdmin ? (
        <p role="status" className="rounded-md border border-[var(--card-border)] p-3 text-sm">Abra uma turma para acessar a busca ativa.</p>
      ) : null}
      <DashboardHero
        eyebrow={isPedagogicalAdmin ? "Administração pedagógica" : "Professor"}
        title={isPedagogicalAdmin ? "Turmas" : "Turmas que leciono"}
        description={
          isPedagogicalAdmin
            ? "Todas as turmas, para consulta, certificados e listagem. A edição fica com o professor da turma."
            : "Lista de alunos, exercícios e frequência — abra cada turma para gerenciar."
        }
      />
      <ProfessorTurmasTabs />
    </div>
  );
}
