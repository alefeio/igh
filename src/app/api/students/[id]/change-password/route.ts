import { prisma } from "@/lib/prisma";
import { hashPassword, requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { z } from "zod";

const bodySchema = z.object({
  newPassword: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres."),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id: studentId } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, userId: true, deletedAt: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }
  if (student.deletedAt) {
    return jsonErr("INVALID_STATE", "Aluno inativo.", 400);
  }
  if (!student.userId) {
    return jsonErr("NO_USER", "Este aluno não possui conta de login.", 400);
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: student.userId },
    data: { passwordHash, mustChangePassword: false },
  });

  return jsonOk({ message: "Senha alterada." });
}
