import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Retorna os perfis disponíveis para o usuário logado (aluno, professor, admin). */
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

  return jsonOk({
    canStudent: !!hasStudent,
    canTeacher: !!hasTeacher,
    canAdmin: user.isAdmin === true,
    canMaster: user.baseRole === "MASTER",
  });
}
