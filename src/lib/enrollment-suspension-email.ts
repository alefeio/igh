import "server-only";

import { createAuditLog } from "@/lib/audit";
import { getAppUrl } from "@/lib/email";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateEnrollmentSuspendedAttendance } from "@/lib/email/templates";
import {
  enqueueEmail,
  hasEnrollmentSuspensionEmailPendingOrSentSince,
} from "@/lib/email/outbox";
import { prisma } from "@/lib/prisma";

export const ENROLLMENT_SUSPENDED_ATTENDANCE_EMAIL_TYPE = "enrollment_suspended_attendance";

function formatClassGroupLabel(cg: {
  startDate: Date;
  startTime: string;
  endTime: string;
  location: string | null;
}): string {
  const date = cg.startDate.toISOString().slice(0, 10).split("-").reverse().join("/");
  const horario = `${cg.startTime}–${cg.endTime}`;
  const loc = cg.location?.trim();
  return loc ? `${date} · ${horario} · ${loc}` : `${date} · ${horario}`;
}

async function getSuspensionEmailDedupeSince(enrollmentId: string): Promise<Date> {
  const lastReactivate = await prisma.auditLog.findFirst({
    where: {
      entityType: "Enrollment",
      entityId: enrollmentId,
      action: "AUTO_REACTIVATE_ATTENDANCE",
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return lastReactivate?.createdAt ?? new Date(0);
}

/**
 * Envia (ou enfileira) e-mail ao aluno quando a matrícula é suspensa por faltas consecutivas.
 * Respeita a cota diária do Resend (100/dia): se esgotada, enfileira para o cron.
 * Não duplica envio na mesma suspensão; permite novo aviso após reativação.
 */
export async function sendEnrollmentSuspensionEmail(params: {
  enrollmentId: string;
  performedByUserId?: string | null;
}): Promise<{ sent: boolean; queued: boolean; skipped: boolean; reason?: string }> {
  const dedupeSince = await getSuspensionEmailDedupeSince(params.enrollmentId);
  const already = await hasEnrollmentSuspensionEmailPendingOrSentSince(
    params.enrollmentId,
    dedupeSince
  );
  if (already) {
    return { sent: false, queued: false, skipped: true, reason: "already_sent_or_queued" };
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: params.enrollmentId },
    select: {
      id: true,
      student: { select: { name: true, email: true } },
      classGroup: {
        select: {
          startDate: true,
          startTime: true,
          endTime: true,
          location: true,
          course: { select: { name: true } },
        },
      },
    },
  });

  if (!enrollment) {
    return { sent: false, queued: false, skipped: true, reason: "enrollment_not_found" };
  }

  const email = enrollment.student.email?.trim();
  if (!email) {
    return { sent: false, queued: false, skipped: true, reason: "no_email" };
  }

  const { subject, html } = templateEnrollmentSuspendedAttendance({
    name: enrollment.student.name,
    courseName: enrollment.classGroup.course.name,
    classGroupLabel: formatClassGroupLabel(enrollment.classGroup),
    loginUrl: getAppUrl("/login"),
    supportUrl: getAppUrl("/suporte"),
  });

  const emailPayload = {
    to: email,
    subject,
    html,
    emailType: ENROLLMENT_SUSPENDED_ATTENDANCE_EMAIL_TYPE,
    entityType: "Enrollment" as const,
    entityId: enrollment.id,
    performedByUserId: params.performedByUserId,
  };

  const result = await sendEmailAndRecord({
    ...emailPayload,
    queueIfDailyQuotaExceeded: true,
  });

  let queued = result.queued === true;
  let sent = result.success && !queued;

  if (!result.success && !queued) {
    await enqueueEmail(emailPayload);
    queued = true;
    sent = false;
  }

  await createAuditLog({
    entityType: "Enrollment",
    entityId: enrollment.id,
    action: "EMAIL_SENT",
    performedByUserId: params.performedByUserId ?? null,
    diff: {
      type: ENROLLMENT_SUSPENDED_ATTENDANCE_EMAIL_TYPE,
      success: sent,
      queued,
      to: email,
      error: result.error,
    },
  });

  if (queued) {
    return { sent: false, queued: true, skipped: false };
  }
  if (sent) {
    return { sent: true, queued: false, skipped: false };
  }
  return { sent: false, queued: false, skipped: false, reason: result.error };
}
