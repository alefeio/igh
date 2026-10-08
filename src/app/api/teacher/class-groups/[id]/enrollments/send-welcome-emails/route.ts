import { createAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { enrollmentNeedsWelcomeEmail } from "@/lib/enrollment-welcome-pending";
import {
  findEnrollmentIdsWithWelcomeEmail,
  sendEnrollmentWelcomeForStudent,
} from "@/lib/enrollment-welcome-email";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/**
 * Envia e-mail de cadastro na turma para alunos ACTIVE/SUSPENDED que ainda não receberam,
 * inclusive pré-matrícula (a mesma regra do botão na página da turma).
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId } = await context.params;

  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

  const cg = await prisma.classGroup.findFirst({
    where: { id: classGroupId, ...classGroupTeacherAccessWhere(teacher.id) },
    select: { id: true },
  });
  if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      classGroupId,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      student: { deletedAt: null },
    },
    select: {
      id: true,
      studentId: true,
      isPreEnrollment: true,
      student: { select: { email: true, name: true, deletedAt: true } },
    },
  });

  const alreadySent = await findEnrollmentIdsWithWelcomeEmail(enrollments.map((e) => e.id));
  const pending = enrollments.filter((e) =>
    enrollmentNeedsWelcomeEmail(
      {
        id: e.id,
        status: e.status,
        email: e.student.email,
        studentDeleted: e.student.deletedAt != null,
      },
      alreadySent,
    ),
  );

  if (pending.length === 0) {
    return jsonOk({
      sent: 0,
      failed: 0,
      skippedNoEmail: enrollments.filter((e) => !e.student.email?.trim()).length,
      pending: 0,
      message: "Não há alunos pendentes de e-mail de cadastro nesta turma.",
    });
  }

  let sent = 0;
  let failed = 0;
  const errors: { enrollmentId: string; studentName: string; reason: string }[] = [];

  for (const e of pending) {
    try {
      if (e.isPreEnrollment) {
        await prisma.enrollment.update({
          where: { id: e.id },
          data: { isPreEnrollment: false },
        });
        await createAuditLog({
          entityType: "Enrollment",
          entityId: e.id,
          action: "UPDATE",
          diff: { isPreEnrollment: false, triggeredBy: "teacher_welcome_email" },
          performedByUserId: user.id,
        });
      }
      const result = await sendEnrollmentWelcomeForStudent({
        studentId: e.studentId,
        enrollmentId: e.id,
        performedByUserId: user.id,
        emailType: "welcome_student",
        auditExtra: { triggeredBy: "teacher" },
      });
      if (result.skipped) {
        failed += 1;
        errors.push({
          enrollmentId: e.id,
          studentName: e.student.name,
          reason: "O envio foi ignorado para esta matrícula.",
        });
        continue;
      }
      if (result.emailSent || result.queued) sent += 1;
      else {
        failed += 1;
        errors.push({
          enrollmentId: e.id,
          studentName: e.student.name,
          reason: result.hadEmail ? "Falha no envio." : "Aluno sem e-mail.",
        });
      }
    } catch {
      failed += 1;
      errors.push({
        enrollmentId: e.id,
        studentName: e.student.name,
        reason: "Erro inesperado ao enviar.",
      });
    }
  }

  return jsonOk({
    sent,
    failed,
    pending: pending.length,
    skippedNoEmail: enrollments.filter((e) => !e.student.email?.trim()).length,
    errors,
    message:
      failed === 0
        ? `E-mail enviado para ${sent} aluno(s).`
        : `Enviados: ${sent}. Falhas: ${failed}.`,
  });
}
