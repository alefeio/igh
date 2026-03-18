import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createEnrollmentSchema } from "@/lib/validators/enrollments";
import { createAuditLog } from "@/lib/audit";
import { formatDateOnly } from "@/lib/format";
import { createVerificationToken } from "@/lib/verification-token";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { getAppUrl } from "@/lib/email";
import { templateStudentWelcome } from "@/lib/email/templates";
import { generateTempPassword } from "@/lib/password";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  const user = await requireRole(["ADMIN", "MASTER", "TEACHER"]);

  const isTeacher = user.role === "TEACHER";
  let teacherId: string | null = null;
  if (isTeacher) {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    teacherId = teacher?.id ?? null;
    if (!teacherId) {
      return jsonOk({ enrollments: [] });
    }
  }

  const enrollments = await prisma.enrollment.findMany({
    where: isTeacher && teacherId
      ? { classGroup: { teacherId } }
      : undefined,
    orderBy: { enrolledAt: "desc" },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          street: true,
          number: true,
          city: true,
          state: true,
          attachments: {
            where: { deletedAt: null },
            select: { type: true },
          },
        },
      },
      classGroup: {
        include: {
          course: { select: { id: true, name: true } },
          teacher: { select: { id: true, name: true } },
        },
      },
    },
  });

  return jsonOk({
    enrollments: enrollments.map((e) => {
      const hasIdDoc = e.student.attachments.some((a) => a.type === "ID_DOCUMENT");
      const hasAddrProof = e.student.attachments.some((a) => a.type === "ADDRESS_PROOF");
      const hasAddress =
        !!(
          e.student.street?.trim() &&
          e.student.number?.trim() &&
          e.student.city?.trim() &&
          e.student.state?.trim()
        );
      const studentDataComplete = hasIdDoc && hasAddrProof && hasAddress;
      const { attachments: _a, ...studentRest } = e.student;
      return {
        id: e.id,
        studentId: e.studentId,
        classGroupId: e.classGroupId,
        enrolledAt: e.enrolledAt,
        status: e.status,
        isPreEnrollment: e.isPreEnrollment,
        enrollmentConfirmedAt: e.enrollmentConfirmedAt,
        certificateUrl: e.certificateUrl,
        certificateFileName: e.certificateFileName,
        student: { ...studentRest },
        classGroup: e.classGroup,
        studentDataComplete,
      };
    }),
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

  const classGroup = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    include: { course: true },
  });
  if (!classGroup) {
    return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);
  }

  const isMaster = user.role === "MASTER";
  if (classGroup.status === "INTERNO" && !isMaster) {
    return jsonErr("FORBIDDEN", "Apenas o usuário Master pode matricular alunos em turmas com status Interno.", 403);
  }
  // Em turmas EXTERNO: Admin e Master podem matricular (não é inscrição pública).
  if (!isMaster && !["ABERTA", "EM_ANDAMENTO", "PLANEJADA", "EXTERNO"].includes(classGroup.status)) {
    return jsonErr("VALIDATION_ERROR", "Esta turma não está aceitando matrículas no momento.", 400);
  }
  if (!isMaster) {
    const activeCount = await prisma.enrollment.count({
      where: { classGroupId, status: "ACTIVE" },
    });
    if (activeCount >= classGroup.capacity) {
      return jsonErr("VALIDATION_ERROR", "Esta turma não possui vagas disponíveis.", 400);
    }
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

  let emailResult = { success: false };

  if (student.email) {
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

    const startDateFormatted = formatDateOnly(classGroup.startDate);
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

    emailResult = await sendEmailAndRecord({
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
  }

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
      studentHadNoEmail: !student.email,
    },
    { status: 201 }
  );
}
