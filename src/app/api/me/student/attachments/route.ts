import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAttachmentSchema } from "@/lib/validators/attachments";

export async function GET() {
  const user = await getSessionUserFromCookie();
  if (!user || user.role !== "STUDENT") {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Cadastro não encontrado.", 404);
  }

  const attachments = await prisma.studentAttachment.findMany({
    where: { studentId: student.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({ attachments });
}

export async function POST(request: Request) {
  const user = await getSessionUserFromCookie();
  if (!user || user.role !== "STUDENT") {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Cadastro não encontrado.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = createAttachmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { type, publicId, url, fileName, mimeType, sizeBytes } = parsed.data;

  const attachment = await prisma.$transaction(async (tx) => {
    await tx.studentAttachment.updateMany({
      where: { studentId: student.id, type, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return tx.studentAttachment.create({
      data: {
        studentId: student.id,
        type,
        publicId,
        url,
        fileName: fileName ?? null,
        mimeType: mimeType ?? null,
        sizeBytes: sizeBytes ?? null,
        uploadedByUserId: user.id,
      },
    });
  });

  return jsonOk({ attachment }, { status: 201 });
}
