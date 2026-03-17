import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/**
 * Permite que ADMIN ou MASTER altere a senha do usuário vinculado ao aluno.
 * O aluno deve ter userId (conta de acesso) para que a alteração seja possível.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id: studentId } = await context.params;

  const body = await request.json().catch(() => null);
  const newPassword =
    typeof body?.newPassword === "string" ? body.newPassword.trim() : "";

  if (newPassword.length < 8) {
    return jsonErr(
      "VALIDATION_ERROR",
      "A nova senha deve ter no mínimo 8 caracteres.",
      400
    );
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, userId: true },
  });

  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  if (!student.userId) {
    return jsonErr(
      "NO_USER_ACCOUNT",
      "Este aluno ainda não possui conta de acesso (vínculo com usuário). Adicione o e-mail ao cadastro do aluno para que ele possa acessar o sistema.",
      400
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: student.userId },
    data: { passwordHash, mustChangePassword: false },
  });

  return jsonOk({ message: "Senha alterada com sucesso." });
}
