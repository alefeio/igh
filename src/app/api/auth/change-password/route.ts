import { prisma } from "@/lib/prisma";
import { requireSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  normalizeTypedStudentPassword,
  studentPasswordCandidates,
} from "@/lib/student-password";

async function verifyCurrentPassword(
  userId: string,
  passwordHash: string,
  currentPassword: string,
): Promise<boolean> {
  if (await verifyPassword(currentPassword, passwordHash)) return true;

  const student = await prisma.student.findFirst({
    where: { userId, deletedAt: null },
    select: { birthDate: true },
  });
  if (!student?.birthDate) return false;

  const typed = normalizeTypedStudentPassword(currentPassword);
  const candidates = studentPasswordCandidates(student.birthDate);
  for (const attempt of typed) {
    if (candidates.includes(attempt) && (await verifyPassword(attempt, passwordHash))) {
      return true;
    }
  }
  for (const candidate of candidates) {
    if (await verifyPassword(candidate, passwordHash)) {
      return typed.some((t) => candidates.includes(t));
    }
  }
  return false;
}

export async function POST(request: Request) {
  const user = await requireSessionUser();

  const body = await request.json().catch(() => null);

  /** Mantém a senha atual e apenas libera o primeiro acesso. */
  if (body?.keepCurrent === true) {
    await prisma.user.update({
      where: { id: user.id },
      data: { mustChangePassword: false },
    });
    return jsonOk({ message: "Senha atual mantida.", kept: true });
  }

  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;

  if (typeof currentPassword !== "string" || currentPassword.length < 1) {
    return jsonErr("VALIDATION_ERROR", "Senha atual é obrigatória.", 400);
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return jsonErr("VALIDATION_ERROR", "Nova senha deve ter no mínimo 8 caracteres.", 400);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser) {
    return jsonErr("NOT_FOUND", "Usuário não encontrado.", 404);
  }

  const valid = await verifyCurrentPassword(user.id, dbUser.passwordHash, currentPassword);
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
