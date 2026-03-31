import { getSessionUserFromCookie, hashPassword, verifyPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validators/me-password";

/** Alteração de senha pelo próprio usuário (qualquer papel autenticado). */
export async function PATCH(request: Request) {
  const sessionUser = await getSessionUserFromCookie();
  if (!sessionUser) {
    return jsonErr("UNAUTHORIZED", "Faça login para continuar.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, passwordHash: true },
  });
  if (!user) {
    return jsonErr("NOT_FOUND", "Usuário não encontrado.", 404);
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    return jsonErr("INVALID_PASSWORD", "Senha atual incorreta.", 400);
  }

  if (currentPassword === newPassword) {
    return jsonErr("VALIDATION_ERROR", "A nova senha deve ser diferente da atual.", 400);
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  return jsonOk({ ok: true as const });
}
