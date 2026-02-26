import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAttachmentSchema } from "@/lib/validators/attachments";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id: studentId } = await context.params;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const attachments = await prisma.studentAttachment.findMany({
    where: { studentId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({ attachments });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const { id: studentId } = await context.params;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = createAttachmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Dados inválidos",
      400
    );
  }

  const { type, publicId, url, fileName, mimeType, sizeBytes } = parsed.data;

  const attachment = await prisma.$transaction(async (tx) => {
    await tx.studentAttachment.updateMany({
      where: { studentId, type, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    const created = await tx.studentAttachment.create({
      data: {
        studentId,
        type,
        publicId,
        url,
        fileName: fileName ?? null,
        mimeType: mimeType ?? null,
        sizeBytes: sizeBytes ?? null,
        uploadedByUserId: user.id,
      },
    });
    await createAuditLog({
      entityType: "StudentAttachment",
      entityId: created.id,
      action: "STUDENT_ATTACHMENT_ADD",
      diff: { studentId, attachmentId: created.id, type, publicId },
      performedByUserId: user.id,
    });
    return created;
  });

  return jsonOk({ attachment }, { status: 201 });
}
