import "server-only";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createVerificationToken } from "@/lib/verification-token";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { getAppUrl } from "@/lib/email";
import { templateStudentWelcome } from "@/lib/email/templates";
import { formatDateOnly } from "@/lib/format";
import { birthDateToStudentPasswordParts } from "@/lib/student-password";

export type WaitlistStatus = "WAITING" | "CONVERTED" | "CANCELLED";

/** Garante User do aluno (senha = nascimento) e envia e-mail de boas-vindas da matrícula. */
export async function sendEnrollmentWelcomeForStudent(args: {
  studentId: string;
  enrollmentId: string;
  performedByUserId?: string | null;
}): Promise<{ emailSent: boolean; hadEmail: boolean }> {
  const student = await prisma.student.findUnique({
    where: { id: args.studentId },
    include: {
      user: true,
      enrollments: {
        where: { id: args.enrollmentId },
        take: 1,
        include: {
          classGroup: { include: { course: { select: { name: true } } } },
        },
      },
    },
  });
  if (!student?.email) return { emailSent: false, hadEmail: false };
  const enrollment = student.enrollments[0];
  if (!enrollment) return { emailSent: false, hadEmail: true };

  let tempPassword: string | null = null;
  let userId = student.userId;

  if (!student.userId || !student.user) {
    const { password: birthPwd } = birthDateToStudentPasswordParts(student.birthDate);
    tempPassword = birthPwd;
    const passwordHash = await hashPassword(tempPassword);
    const createdUser = await prisma.user.create({
      data: {
        name: student.name,
        email: student.email,
        passwordHash,
        role: "STUDENT",
        isActive: true,
        mustChangePassword: true,
        birthDate: student.birthDate,
      },
    });
    userId = createdUser.id;
    await prisma.student.update({
      where: { id: student.id },
      data: { userId: createdUser.id },
    });
  }

  const { token, expiresAt } = await createVerificationToken({
    userId: userId!,
    type: "ENROLLMENT_CONFIRMATION",
    studentId: student.id,
    enrollmentId: enrollment.id,
    expiresInDays: 7,
  });

  const confirmUrl = getAppUrl(`/confirmar-inscricao?token=${token}`);
  const classGroup = enrollment.classGroup;
  const startDateFormatted = formatDateOnly(classGroup.startDate);
  const daysFormatted = Array.isArray(classGroup.daysOfWeek)
    ? classGroup.daysOfWeek.join(", ")
    : String(classGroup.daysOfWeek);

  const { subject, html } = templateStudentWelcome({
    name: student.name,
    email: student.email,
    tempPassword,
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
    emailType: "welcome_student_waitlist",
    entityType: "Enrollment",
    entityId: enrollment.id,
    performedByUserId: args.performedByUserId ?? undefined,
  });

  await createAuditLog({
    entityType: "Enrollment",
    entityId: enrollment.id,
    action: "EMAIL_SENT",
    diff: {
      type: "welcome_student_waitlist",
      success: emailResult.success,
      expiresAt: expiresAt.toISOString(),
      fromWaitlist: true,
    },
    performedByUserId: args.performedByUserId ?? undefined,
  });

  return { emailSent: emailResult.success, hadEmail: true };
}

/**
 * Se houver vaga e reserva WAITING, promove o primeiro da fila (FIFO) a matrícula ACTIVE
 * e dispara o e-mail de acesso.
 */
export async function promoteNextWaitlistForClassGroup(
  classGroupId: string,
  performedByUserId?: string | null,
): Promise<{ promoted: boolean; enrollmentId?: string; studentId?: string }> {
  const classGroup = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: { id: true, capacity: true, status: true },
  });
  if (!classGroup) return { promoted: false };
  if (["ENCERRADA", "CANCELADA"].includes(classGroup.status)) {
    return { promoted: false };
  }

  const result = await prisma.$transaction(async (tx) => {
    const activeCount = await tx.enrollment.count({
      where: { classGroupId, status: "ACTIVE" },
    });
    if (activeCount >= classGroup.capacity) {
      return null;
    }

    // Tenta o próximo WAITING válido (pula quem já tenha matrícula ACTIVE).
    for (let attempt = 0; attempt < 20; attempt++) {
      const next = await tx.enrollmentWaitlist.findFirst({
        where: { classGroupId, status: "WAITING" },
        orderBy: { createdAt: "asc" },
        select: { id: true, studentId: true },
      });
      if (!next) return null;

      const alreadyActive = await tx.enrollment.findFirst({
        where: { studentId: next.studentId, classGroupId, status: "ACTIVE" },
        select: { id: true },
      });
      if (alreadyActive) {
        await tx.enrollmentWaitlist.update({
          where: { id: next.id },
          data: { status: "CANCELLED" },
        });
        continue;
      }

      const enrollment = await tx.enrollment.create({
        data: {
          studentId: next.studentId,
          classGroupId,
          status: "ACTIVE",
          isPreEnrollment: false,
        },
      });

      await tx.enrollmentWaitlist.update({
        where: { id: next.id },
        data: {
          status: "CONVERTED",
          convertedEnrollmentId: enrollment.id,
        },
      });

      return { enrollmentId: enrollment.id, studentId: next.studentId, waitlistId: next.id };
    }

    return null;
  });

  if (!result) return { promoted: false };

  await createAuditLog({
    entityType: "Enrollment",
    entityId: result.enrollmentId,
    action: "CREATE",
    diff: {
      fromWaitlist: true,
      waitlistId: result.waitlistId,
      studentId: result.studentId,
      classGroupId,
    },
    performedByUserId: performedByUserId ?? undefined,
  });

  await sendEnrollmentWelcomeForStudent({
    studentId: result.studentId,
    enrollmentId: result.enrollmentId,
    performedByUserId,
  });

  return {
    promoted: true,
    enrollmentId: result.enrollmentId,
    studentId: result.studentId,
  };
}

/** Após liberar vaga (cancelamento/exclusão), tenta promover a próxima reserva. */
export async function tryPromoteWaitlistAfterSeatFreed(
  classGroupId: string,
  performedByUserId?: string | null,
): Promise<void> {
  try {
    await promoteNextWaitlistForClassGroup(classGroupId, performedByUserId);
  } catch (e) {
    console.error("[waitlist] falha ao promover reserva", classGroupId, e);
  }
}
