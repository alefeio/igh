import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Retorna os perfis disponíveis para o usuário logado (aluno, professor, admin, coordenador, master). */
export async function GET() {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Faça login para continuar.", 401);
  }

  const [hasStudent, hasTeacher] = await Promise.all([
    prisma.student.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    }),
    prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    }),
  ]);

  const base = user.baseRole;
  const canMaster = base === "MASTER";
  const canCoordinator = base === "COORDINATOR";
  const canAdmin = user.isAdmin === true || base === "ADMIN";

  return jsonOk({
    canStudent: !!hasStudent,
    canTeacher: !!hasTeacher,
    canAdmin,
    canCoordinator,
    canMaster,
  });
}
