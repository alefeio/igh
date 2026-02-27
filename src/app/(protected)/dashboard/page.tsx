import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
  MASTER: "Administrador Master",
  ADMIN: "Administrador",
  TEACHER: "Professor",
  STUDENT: "Aluno",
};

export default async function DashboardPage() {
  const user = await requireSessionUser();

  const isAdminOrMaster = user.role === "MASTER" || user.role === "ADMIN";

  const [teachers, courses, classGroups] = isAdminOrMaster
    ? await Promise.all([
        prisma.teacher.count({ where: { deletedAt: null } }),
        prisma.course.count(),
        prisma.classGroup.count(),
      ])
    : [0, 0, 0];

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="card-header">
          <div className="text-lg font-semibold">Dashboard</div>
          <div className="mt-1 text-sm text-zinc-600">
            Olá, {user.name}. Seu perfil: <span className="font-medium">{ROLE_LABELS[user.role] ?? user.role}</span>
          </div>
        </div>
        <div className="card-body">
          {isAdminOrMaster ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-zinc-200 bg-white p-3">
                <div className="text-xs text-zinc-600">Professores</div>
                <div className="text-2xl font-semibold">{teachers}</div>
              </div>
              <div className="rounded-md border border-zinc-200 bg-white p-3">
                <div className="text-xs text-zinc-600">Cursos</div>
                <div className="text-2xl font-semibold">{courses}</div>
              </div>
              <div className="rounded-md border border-zinc-200 bg-white p-3">
                <div className="text-xs text-zinc-600">Turmas</div>
                <div className="text-2xl font-semibold">{classGroups}</div>
              </div>
            </div>
          ) : (
            <p className="text-zinc-600">
              Bem-vindo ao sistema. Use o menu ao lado para acessar as funcionalidades disponíveis para o seu perfil.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
