import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { staffCanAccessStudent } from "@/lib/student-staff-scope";

/** Remoção lógica de anexo. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  const user = await requireRole(["MASTER", "ADMIN", "TEACHER", "POLO_COORDINATOR"]);
  const { id: studentId, attachmentId } = await context.params;

  if (!(await staffCanAccessStudent(user, studentId))) {
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
