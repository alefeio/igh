import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAuditLog } from "@/lib/audit";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const user = await requireRole("MASTER");
  const { id: studentId, attachmentId } = await context.params;

  const attachment = await prisma.studentAttachment.findFirst({
    where: { id: attachmentId, studentId, deletedAt: null },
  });
  if (!attachment) {
    return jsonErr("NOT_FOUND", "Anexo não encontrado.", 404);
  }

  const updated = await prisma.studentAttachment.update({
    where: { id: attachmentId },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    entityType: "StudentAttachment",
    entityId: attachmentId,
    action: "STUDENT_ATTACHMENT_REMOVE",
    diff: { studentId, attachmentId, type: attachment.type, publicId: attachment.publicId },
    performedByUserId: user.id,
  });

  return jsonOk({ attachment: updated });
}
