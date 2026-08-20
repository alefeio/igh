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
import {
  ENROLLMENT_WELCOME_EMAIL_TYPES,
  findEnrollmentIdsWithWelcomeEmail,
  hasEnrollmentWelcomeEmailPendingOrSent,
} from "@/lib/email/outbox";

export { ENROLLMENT_WELCOME_EMAIL_TYPES, findEnrollmentIdsWithWelcomeEmail };

export type EnrollmentWelcomeEmailType = (typeof ENROLLMENT_WELCOME_EMAIL_TYPES)[number];

/**
 * Garante User do aluno (senha = nascimento) e envia e-mail de boas-vindas da matrícula.
 * Usado na promoção da lista de espera e no reenvio pelo professor.
 */
export async function sendEnrollmentWelcomeForStudent(args: {
  studentId: string;
  enrollmentId: string;
  performedByUserId?: string | null;
  emailType?: EnrollmentWelcomeEmailType;
  /** Extra no audit (ex.: fromWaitlist). */
  auditExtra?: Record<string, unknown>;
}): Promise<{ emailSent: boolean; hadEmail: boolean; queued?: boolean; skipped?: boolean }> {
  const emailType = args.emailType ?? "welcome_student";
  if (await hasEnrollmentWelcomeEmailPendingOrSent(args.enrollmentId)) {
    return { emailSent: false, hadEmail: true, skipped: true };
  }
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
    emailType,
    entityType: "Enrollment",
    entityId: enrollment.id,
    performedByUserId: args.performedByUserId ?? undefined,
  });

  if (emailResult.skippedDuplicate) {
    return { emailSent: false, hadEmail: true, skipped: true };
  }

  await createAuditLog({
    entityType: "Enrollment",
    entityId: enrollment.id,
    action: "EMAIL_SENT",
    diff: {
      type: emailType,
      success: emailResult.success,
      queued: emailResult.queued ?? false,
      expiresAt: expiresAt.toISOString(),
      ...(args.auditExtra ?? {}),
    },
    performedByUserId: args.performedByUserId ?? undefined,
  });

  return {
    emailSent: emailResult.success,
    hadEmail: true,
    queued: emailResult.queued,
  };
}
