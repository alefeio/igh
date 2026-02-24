import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireRole(["MASTER", "ADMIN"]);

  const [teachers, courses, classGroups] = await Promise.all([
    prisma.teacher.count({ where: { deletedAt: null } }),
    prisma.course.count(),
    prisma.classGroup.count(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="card-header">
          <div className="text-lg font-semibold">Dashboard</div>
          <div className="mt-1 text-sm text-zinc-600">
            Olá, {user.name}. Seu perfil: <span className="font-medium">{user.role}</span>
          </div>
        </div>
        <div className="card-body">
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
        </div>
      </div>
    </div>
  );
}
