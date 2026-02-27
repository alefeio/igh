import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateEnrollmentSchema } from "@/lib/validators/enrollments";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await context.params;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true, email: true } },
      classGroup: {
        include: {
          course: { select: { id: true, name: true } },
          teacher: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  return jsonOk({
    enrollment: {
      id: enrollment.id,
      studentId: enrollment.studentId,
      classGroupId: enrollment.classGroupId,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      enrollmentConfirmedAt: enrollment.enrollmentConfirmedAt,
      certificateUrl: enrollment.certificateUrl,
      certificateFileName: enrollment.certificateFileName,
      student: enrollment.student,
      classGroup: enrollment.classGroup,
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const { id } = await context.params;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateEnrollmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const data: {
    status?: string;
    certificateUrl?: string | null;
    certificatePublicId?: string | null;
    certificateFileName?: string | null;
  } = {};
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.certificateUrl !== undefined) data.certificateUrl = parsed.data.certificateUrl || null;
  if (parsed.data.certificatePublicId !== undefined) data.certificatePublicId = parsed.data.certificatePublicId || null;
  if (parsed.data.certificateFileName !== undefined) data.certificateFileName = parsed.data.certificateFileName || null;

  const updated = await prisma.enrollment.update({
    where: { id },
    data,
    include: {
      student: { select: { id: true, name: true, email: true } },
      classGroup: { include: { course: { select: { id: true, name: true } } } },
    },
  });

  await createAuditLog({
    entityType: "Enrollment",
    entityId: id,
    action: "UPDATE",
    diff: { updates: data },
    performedByUserId: user.id,
  });

  return jsonOk({
    enrollment: {
      id: updated.id,
      studentId: updated.studentId,
      classGroupId: updated.classGroupId,
      status: updated.status,
      certificateUrl: updated.certificateUrl,
      certificateFileName: updated.certificateFileName,
      student: updated.student,
      classGroup: updated.classGroup,
    },
  });
}
