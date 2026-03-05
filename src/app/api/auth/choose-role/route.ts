import { prisma } from "@/lib/prisma";
import { createSessionCookie, getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import type { UserRole } from "@/generated/prisma/client";

const ALLOWED_ROLES: UserRole[] = ["STUDENT", "TEACHER", "ADMIN"];

/** Define o papel com o qual o usuário vai acessar (Aluno, Professor ou Admin quando tem múltiplos perfis). */
export async function POST(request: Request) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Faça login para continuar.", 401);
  }

  const body = await request.json().catch(() => null);
  const role = body?.role as UserRole | undefined;
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return jsonErr("VALIDATION_ERROR", "Escolha inválida.", 400);
  }

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true, isAdmin: true, isActive: true, mustChangePassword: true },
  });
  if (!full || !full.isActive) {
    return jsonErr("UNAUTHORIZED", "Sessão inválida.", 401);
  }

  if (role === "ADMIN") {
    if (!full.isAdmin) {
      return jsonErr("FORBIDDEN", "Você não tem acesso como Admin.", 403);
    }
    await createSessionCookie(full, "ADMIN");
    return jsonOk({ role: "ADMIN" });
  }

  if (role === "STUDENT" || role === "TEACHER") {
    if (full.role !== role) {
      return jsonErr("FORBIDDEN", "Você não tem esse perfil.", 403);
    }
    await createSessionCookie(full, role);
    return jsonOk({ role });
  }

  return jsonErr("VALIDATION_ERROR", "Escolha inválida.", 400);
}
