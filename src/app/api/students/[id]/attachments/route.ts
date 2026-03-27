import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAttachmentSchema } from "@/lib/validators/attachments";

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

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["ADMIN", "MASTER", "TEACHER", "COORDINATOR"]);
  const { id: studentId } = await context.params;

  if (!(await canAccessStudent(user, studentId))) {
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR", "TEACHER"]);
  const { id: studentId } = await context.params;

  if (!(await canAccessStudent(user, studentId))) {
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

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
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { type, publicId, url, fileName, mimeType, sizeBytes } = parsed.data;

  const attachment = await prisma.$transaction(async (tx) => {
    await tx.studentAttachment.updateMany({
      where: { studentId, type, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return tx.studentAttachment.create({
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
  });

  return jsonOk({ attachment }, { status: 201 });
}
