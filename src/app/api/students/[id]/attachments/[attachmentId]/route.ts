import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

async function canAccessStudent(user: SessionUser, studentId: string): Promise<boolean> {
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) return false;
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, classGroup: { teacherId: teacher.id } },
      select: { id: true },
    });
    return !!enrollment;
  }
  return user.role === "ADMIN" || user.role === "MASTER" || user.role === "COORDINATOR";
}

/** Remoção lógica de anexo (Master, Admin ou Coordenador). */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  const user = await requireRole(["MASTER", "ADMIN", "COORDINATOR"]);
  const { id: studentId, attachmentId } = await context.params;

  if (!(await canAccessStudent(user, studentId))) {
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

  const att = await prisma.studentAttachment.findFirst({
    where: { id: attachmentId, studentId, deletedAt: null },
    select: { id: true },
  });
  if (!att) {
    return jsonErr("NOT_FOUND", "Anexo não encontrado.", 404);
  }

  await prisma.studentAttachment.update({
    where: { id: attachmentId },
    data: { deletedAt: new Date() },
  });

  return jsonOk({ deleted: true });
}
