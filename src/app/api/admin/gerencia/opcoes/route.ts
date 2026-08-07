import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/**
 * Contas e polos oferecidos nos formulários da gerência.
 * Alunos ficam de fora.
 * - padrão: só quem ainda não tem ficha de colaborador (para vincular).
 * - `?allStaff=true`: toda a equipe ativa (ex.: responsável financeiro).
 * - `?includeUserId=`: mantém o usuário já vinculado ao editar colaborador.
 */
export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const includeUserId = searchParams.get("includeUserId");
  const allStaff = searchParams.get("allStaff") === "true";

  const [users, polos] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { not: "STUDENT" },
        ...(allStaff
          ? {}
          : {
              OR: [{ employee: null }, ...(includeUserId ? [{ id: includeUserId }] : [])],
            }),
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
