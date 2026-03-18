import Link from "next/link";
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
    enrollmentsCount: cg._count.enrollments,
  }));

  return (
    <div className="container-page flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          Turmas que leciono
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Acesse cada turma para ver a lista de alunos, exercícios realizados e registrar frequência nas aulas liberadas.
        </p>
      </header>

      {classGroupsForTable.length === 0 ? (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-8 text-center text-[var(--text-muted)]">
          Você não tem turmas atribuídas no momento.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)]">
                <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Curso</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Status</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Início</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">Horário</th>
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
        </div>
      )}
    </div>
  );
}
