import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createEnrollmentSchema } from "@/lib/validators/enrollments";
import { createAuditLog } from "@/lib/audit";
import { createVerificationToken } from "@/lib/verification-token";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { getAppUrl } from "@/lib/email";
import { templateStudentWelcome } from "@/lib/email/templates";
import { generateTempPassword } from "@/lib/password";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);

  const enrollments = await prisma.enrollment.findMany({
    orderBy: { enrolledAt: "desc" },
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

  return jsonOk({
    enrollments: enrollments.map((e) => ({
      id: e.id,
      studentId: e.studentId,
      classGroupId: e.classGroupId,
      enrolledAt: e.enrolledAt,
      status: e.status,
      enrollmentConfirmedAt: e.enrollmentConfirmedAt,
      certificateUrl: e.certificateUrl,
      certificateFileName: e.certificateFileName,
      student: e.student,
      classGroup: e.classGroup,
    })),
  });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);

  const body = await request.json().catch(() => null);
  const parsed = createEnrollmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { studentId, classGroupId } = parsed.data;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }
  if (!student.email) {
    return jsonErr("VALIDATION_ERROR", "O aluno precisa ter e-mail cadastrado para receber o link de confirmação.", 400);
  }

  const classGroup = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    include: { course: true },
  });
  if (!classGroup) {
    return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);
  }

  const existing = await prisma.enrollment.findFirst({
    where: { studentId, classGroupId, status: "ACTIVE" },
  });
  if (existing) {
    return jsonErr("DUPLICATE", "Este aluno já está matriculado nesta turma.", 409);
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId,
      classGroupId,
      status: "ACTIVE",
    },
  });

  await createAuditLog({
    entityType: "Enrollment",
    entityId: enrollment.id,
    action: "CREATE",
    diff: { after: enrollment },
    performedByUserId: user.id,
  });

  let tempPassword: string | null = null;
  let userId = student.userId;

  if (!student.userId || !student.user) {
    tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const createdUser = await prisma.user.create({
      data: {
        name: student.name,
        email: student.email,
        passwordHash,
        role: "STUDENT",
        isActive: true,
        mustChangePassword: true,
      },
    });
    userId = createdUser.id;
    await prisma.student.update({
      where: { id: studentId },
      data: { userId: createdUser.id },
    });
  } else if (student.user.mustChangePassword) {
    tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await prisma.user.update({
      where: { id: student.userId },
      data: { passwordHash, mustChangePassword: true },
    });
  }

  const { token, expiresAt } = await createVerificationToken({
    userId: userId!,
    type: "ENROLLMENT_CONFIRMATION",
    studentId,
    enrollmentId: enrollment.id,
    expiresInDays: 7,
  });

  const confirmUrl = getAppUrl(`/confirmar-inscricao?token=${token}`);

  const startDateFormatted = classGroup.startDate.toLocaleDateString("pt-BR");
  const daysFormatted = Array.isArray(classGroup.daysOfWeek)
    ? classGroup.daysOfWeek.join(", ")
    : String(classGroup.daysOfWeek);

  const { subject, html } = templateStudentWelcome({
    name: student.name,
    email: student.email,
    tempPassword: tempPassword ?? null,
    courseName: classGroup.course.name,
    startDate: startDateFormatted,
    daysOfWeek: daysFormatted,
    startTime: classGroup.startTime,
    endTime: classGroup.endTime,
    location: classGroup.location,
    confirmUrl,
  });

  const emailResult = await sendEmailAndRecord({
    to: student.email,
    subject,
    html,
    emailType: "welcome_student",
    entityType: "Enrollment",
    entityId: enrollment.id,
    performedByUserId: user.id,
  });

  await createAuditLog({
    entityType: "Enrollment",
    entityId: enrollment.id,
    action: "EMAIL_SENT",
    diff: {
      type: "welcome_student",
      success: emailResult.success,
      expiresAt: expiresAt.toISOString(),
    },
    performedByUserId: user.id,
  });

  const enrollmentWithRelations = await prisma.enrollment.findUnique({
    where: { id: enrollment.id },
    include: {
      student: { select: { id: true, name: true, email: true } },
      classGroup: { include: { course: { select: { id: true, name: true } } } },
    },
  });

  return jsonOk(
    {
      enrollment: enrollmentWithRelations,
      emailSent: emailResult.success,
    },
    { status: 201 }
  );
}
