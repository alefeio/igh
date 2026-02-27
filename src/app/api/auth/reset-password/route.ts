import { prisma } from "@/lib/prisma";
import { consumeVerificationToken } from "@/lib/verification-token";
import { hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!token) {
    return jsonErr("VALIDATION_ERROR", "Token é obrigatório.", 400);
  }
  if (newPassword.length < 8) {
    return jsonErr("VALIDATION_ERROR", "A nova senha deve ter no mínimo 8 caracteres.", 400);
  }

  const payload = await consumeVerificationToken({ rawToken: token, type: "PASSWORD_RESET" });
  if (!payload) {
    return jsonErr("INVALID_TOKEN", "Link inválido ou expirado. Solicite uma nova redefinição de senha.", 400);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: payload.userId },
    data: { passwordHash, mustChangePassword: false },
  });

  return jsonOk({ message: "Senha alterada. Faça login com a nova senha." });
}
