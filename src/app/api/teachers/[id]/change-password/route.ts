import { prisma } from "@/lib/prisma";
import { hashPassword, requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { authErrorResponse } from "@/lib/api-auth-guard";
import { z } from "zod";

const bodySchema = z.object({
  newPassword: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres."),
});

/** Master ou administrador pedagógico define uma nova senha de login do professor. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(["ADMIN", "MASTER"]);
    const { id: teacherId } = await context.params;

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, name: true, userId: true, deletedAt: true },
    });
    if (!teacher) {
      return jsonErr("NOT_FOUND", "Professor não encontrado.", 404);
    }
    if (!teacher.userId) {
      return jsonErr("NO_USER", "Este professor não possui conta de login.", 400);
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: teacher.userId },
      data: { passwordHash, mustChangePassword: false },
    });

    await createAuditLog({
      entityType: "Teacher",
      entityId: teacher.id,
      action: "UPDATE",
      performedByUserId: actor.id,
      diff: { passwordChanged: true, teacherName: teacher.name },
    });

    return jsonOk({ message: "Senha alterada." });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
