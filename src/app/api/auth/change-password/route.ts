import { prisma } from "@/lib/prisma";
import { requireSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  const user = await requireSessionUser();

  const body = await request.json().catch(() => null);
  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;

  if (typeof currentPassword !== "string" || currentPassword.length < 1) {
    return jsonErr("VALIDATION_ERROR", "Senha atual e obrigatoria.", 400);
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return jsonErr("VALIDATION_ERROR", "Nova senha deve ter no minimo 8 caracteres.", 400);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser) {
    return jsonErr("NOT_FOUND", "Usuario nao encontrado.", 404);
  }

  const valid = await verifyPassword(currentPassword, dbUser.passwordHash);
  if (!valid) {
    return jsonErr("INVALID_CREDENTIALS", "Senha atual incorreta.", 401);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  return jsonOk({ message: "Senha alterada." });
}
