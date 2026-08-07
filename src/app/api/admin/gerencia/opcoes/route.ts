import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/**
 * Contas e polos oferecidos no formulário de colaborador.
 * Alunos ficam de fora: a ficha administrativa é da equipe.
 * `?includeUserId=` mantém o usuário já vinculado ao editar.
 */
export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const includeUserId = new URL(request.url).searchParams.get("includeUserId");

  const [users, polos] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { not: "STUDENT" },
        OR: [{ employee: null }, ...(includeUserId ? [{ id: includeUserId }] : [])],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.polo.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return jsonOk({ users, polos });
}
