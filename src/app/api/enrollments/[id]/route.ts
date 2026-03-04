import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateEnrollmentSchema } from "@/lib/validators/enrollments";
import { createAuditLog } from "@/lib/audit";
import { createVerificationToken } from "@/lib/verification-token";
import { getAppUrl } from "@/lib/email";
import { templateStudentWelcome } from "@/lib/email/templates";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";

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
      isPreEnrollment: enrollment.isPreEnrollment,
      enrolledAt: enrollment.enrolledAt,
      enrollmentConfirmedAt: enrollment.enrollmentConfirmedAt,
      certificateUrl: enrollment.certificateUrl,
      certificateFileName: enrollment.certificateFileName,
      student: enrollment.student,
      classGroup: enrollment.classGroup,
    },
  });
}

/** Atualiza matrícula (confirmar pré-matrícula, editar status/certificado). Apenas MASTER. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("MASTER");
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
    isPreEnrollment?: boolean;
    certificateUrl?: string | null;
    certificatePublicId?: string | null;
    certificateFileName?: string | null;
  } = {};
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.isPreEnrollment !== undefined) data.isPreEnrollment = parsed.data.isPreEnrollment;
  if (parsed.data.certificateUrl !== undefined) data.certificateUrl = parsed.data.certificateUrl || null;
  if (parsed.data.certificatePublicId !== undefined) data.certificatePublicId = parsed.data.certificatePublicId || null;
  if (parsed.data.certificateFileName !== undefined) data.certificateFileName = parsed.data.certificateFileName || null;

  const updated = await prisma.enrollment.update({
    where: { id },
    data,
    include: {
      student: { select: { id: true, name: true, email: true, userId: true } },
      classGroup: {
        include: {
          course: { select: { id: true, name: true } },
          teacher: { select: { id: true } },
        },
      },
    },
  });

  await createAuditLog({
    entityType: "Enrollment",
    entityId: id,
    action: "UPDATE",
    diff: { updates: data },
    performedByUserId: user.id,
  });

  if (parsed.data.isPreEnrollment === false && updated.student.email && updated.student.userId) {
    const { token, expiresAt } = await createVerificationToken({
      userId: updated.student.userId,
      type: "ENROLLMENT_CONFIRMATION",
      studentId: updated.studentId,
      enrollmentId: id,
      expiresInDays: 7,
    });
    const confirmUrl = getAppUrl(`/confirmar-inscricao?token=${token}`);
    const classGroup = updated.classGroup;
    const startDateFormatted = classGroup.startDate.toLocaleDateString("pt-BR");
    const daysFormatted = Array.isArray(classGroup.daysOfWeek)
      ? classGroup.daysOfWeek.join(", ")
      : String(classGroup.daysOfWeek);
    const { subject, html } = templateStudentWelcome({
      name: updated.student.name,
      email: updated.student.email,
      tempPassword: null,
      courseName: classGroup.course.name,
      startDate: startDateFormatted,
      daysOfWeek: daysFormatted,
      startTime: classGroup.startTime,
      endTime: classGroup.endTime,
      location: classGroup.location,
      confirmUrl,
    });
    await sendEmailAndRecord({
      to: updated.student.email,
      subject,
      html,
      emailType: "welcome_student",
      entityType: "Enrollment",
      entityId: id,
      performedByUserId: user.id,
    });
    await createAuditLog({
      entityType: "Enrollment",
      entityId: id,
      action: "EMAIL_SENT",
      diff: { type: "welcome_student", expiresAt: expiresAt.toISOString() },
      performedByUserId: user.id,
    });
  }

  return jsonOk({
    enrollment: {
      id: updated.id,
      studentId: updated.studentId,
      classGroupId: updated.classGroupId,
      status: updated.status,
      isPreEnrollment: updated.isPreEnrollment,
      certificateUrl: updated.certificateUrl,
      certificateFileName: updated.certificateFileName,
      student: updated.student,
      classGroup: updated.classGroup,
    },
  });
}

/** Exclui uma matrícula. Apenas MASTER. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    select: { id: true, studentId: true, classGroupId: true },
  });
  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  await prisma.enrollment.delete({ where: { id } });

  await createAuditLog({
    entityType: "Enrollment",
    entityId: id,
    action: "DELETE",
    diff: { deleted: enrollment },
    performedByUserId: user.id,
  });

  return jsonOk({ deleted: true });
}
