import Link from "next/link";

import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { requireSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const STATUS_LABELS: Record<string, string> = {
  PLANEJADA: "Planejada",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
  INTERNO: "Interno",
  EXTERNO: "Externo",
};

/** Formata data apenas (sem mudança de fuso): evita dia anterior quando o Date vem em UTC (ex.: do Prisma). */
function formatDate(d: Date) {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

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
  const classGroups = await prisma.classGroup.findMany({
    where: { teacherId: teacher.id },
    orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      course: { select: { name: true } },
      startDate: true,
      startTime: true,
      endTime: true,
      status: true,
      capacity: true,
      location: true,
      _count: { select: { enrollments: true } },
    },
  });
  const classGroupsForTable = classGroups.map((cg) => ({
    id: cg.id,
    courseName: cg.course.name,
    startDate: cg.startDate,
    startTime: cg.startTime,
    endTime: cg.endTime,
    status: cg.status,
    capacity: cg.capacity,
    location: cg.location,
    enrollmentsCount: cg._count.enrollments,
  }));

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <DashboardHero
        eyebrow="Professor"
        title="Turmas que leciono"
        description="Lista de alunos, exercícios e frequência — abra cada turma para gerenciar."
      />

      <SectionCard
        title="Suas turmas"
        description={
          classGroupsForTable.length === 0
            ? "Nenhuma turma atribuída no momento."
            : `${classGroupsForTable.length} ${classGroupsForTable.length === 1 ? "turma" : "turmas"}.`
        }
        variant="elevated"
      >
      {classGroupsForTable.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/80 px-6 py-12 text-center text-[var(--text-muted)]">
          Você não tem turmas atribuídas no momento.
        </div>
      ) : (
        <TableShell>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]">
                <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Curso</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Status</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Início</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Horário</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Local</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Alunos</th>
                <th className="px-3 py-2 text-right font-medium text-[var(--text-primary)]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {classGroupsForTable.map((cg) => (
                <tr key={cg.id} className="border-b border-[var(--card-border)] last:border-b-0">
                  <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                    <Link
                      href={`/professor/turmas/${cg.id}`}
                      className="text-[var(--igh-primary)] hover:underline"
                    >
                      {cg.courseName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                    {STATUS_LABELS[cg.status] ?? cg.status}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{formatDate(cg.startDate)}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                    {cg.startTime} – {cg.endTime}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)] max-w-[200px] truncate" title={cg.location ?? undefined}>
                    {cg.location?.trim() ? cg.location : "—"}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                    {cg.enrollmentsCount} / {cg.capacity}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/professor/turmas/${cg.id}`}
                      className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1.5 text-sm font-medium text-[var(--igh-primary)] hover:bg-[var(--igh-surface)]"
                    >
                      Ver turma
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
      </SectionCard>
    </div>
  );
}
