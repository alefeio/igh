import "server-only";

import { createAuditLog } from "@/lib/audit";
import { getAppUrl } from "@/lib/email";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import {
  templateEnrollmentCancelled,
  templateEnrollmentSuspended,
} from "@/lib/email/templates";
import {
  enqueueEmail,
  hasEmailPendingOrSent,
  hasEnrollmentSuspensionEmailPendingOrSentSince,
} from "@/lib/email/outbox";
import { prisma } from "@/lib/prisma";

export const ENROLLMENT_SUSPENDED_ATTENDANCE_EMAIL_TYPE = "enrollment_suspended_attendance";
export const ENROLLMENT_CANCELLED_EMAIL_TYPE = "enrollment_cancelled";

export type EnrollmentStatusEmailCause = "attendance" | "staff";

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

async function loadEnrollmentForStatusEmail(enrollmentId: string) {
  return prisma.enrollment.findUnique({
    where: { id: enrollmentId },
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
}

async function sendOrQueueEnrollmentEmail(params: {
  enrollmentId: string;
  to: string;
  subject: string;
  html: string;
  emailType: string;
  performedByUserId?: string | null;
}): Promise<{ sent: boolean; queued: boolean; skipped: boolean; reason?: string }> {
  const emailPayload = {
    to: params.to,
    subject: params.subject,
    html: params.html,
    emailType: params.emailType,
    entityType: "Enrollment" as const,
    entityId: params.enrollmentId,
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
    entityId: params.enrollmentId,
    action: "EMAIL_SENT",
    performedByUserId: params.performedByUserId ?? null,
    diff: {
      type: params.emailType,
      success: sent,
      queued,
      to: params.to,
      error: result.error,
    },
  });

  if (queued) return { sent: false, queued: true, skipped: false };
  if (sent) return { sent: true, queued: false, skipped: false };
  return { sent: false, queued: false, skipped: false, reason: result.error };
}

/**
 * Envia (ou enfileira) e-mail ao aluno quando a matrícula é suspensa.
 * Não duplica envio na mesma suspensão; permite novo aviso após reativação.
 */
export async function sendEnrollmentSuspensionEmail(params: {
  enrollmentId: string;
  performedByUserId?: string | null;
  cause?: EnrollmentStatusEmailCause;
}): Promise<{ sent: boolean; queued: boolean; skipped: boolean; reason?: string }> {
  const dedupeSince = await getSuspensionEmailDedupeSince(params.enrollmentId);
  const already = await hasEnrollmentSuspensionEmailPendingOrSentSince(
    params.enrollmentId,
    dedupeSince
  );
  if (already) {
    return { sent: false, queued: false, skipped: true, reason: "already_sent_or_queued" };
  }

  const enrollment = await loadEnrollmentForStatusEmail(params.enrollmentId);
  if (!enrollment) {
    return { sent: false, queued: false, skipped: true, reason: "enrollment_not_found" };
  }

  const email = enrollment.student.email?.trim();
  if (!email) {
    return { sent: false, queued: false, skipped: true, reason: "no_email" };
  }

  const { subject, html } = templateEnrollmentSuspended({
    name: enrollment.student.name,
    courseName: enrollment.classGroup.course.name,
    classGroupLabel: formatClassGroupLabel(enrollment.classGroup),
    loginUrl: getAppUrl("/login"),
    supportUrl: getAppUrl("/suporte"),
    cause: params.cause ?? "attendance",
  });

  return sendOrQueueEnrollmentEmail({
    enrollmentId: enrollment.id,
    to: email,
    subject,
    html,
    emailType: ENROLLMENT_SUSPENDED_ATTENDANCE_EMAIL_TYPE,
    performedByUserId: params.performedByUserId,
  });
}

/** Envia (ou enfileira) e-mail ao aluno quando a matrícula é cancelada. */
export async function sendEnrollmentCancellationEmail(params: {
  enrollmentId: string;
  performedByUserId?: string | null;
  cause?: EnrollmentStatusEmailCause | "self";
}): Promise<{ sent: boolean; queued: boolean; skipped: boolean; reason?: string }> {
  const already = await hasEmailPendingOrSent({
    emailType: ENROLLMENT_CANCELLED_EMAIL_TYPE,
    entityType: "Enrollment",
    entityId: params.enrollmentId,
  });
  if (already) {
    return { sent: false, queued: false, skipped: true, reason: "already_sent_or_queued" };
  }

  const enrollment = await loadEnrollmentForStatusEmail(params.enrollmentId);
  if (!enrollment) {
    return { sent: false, queued: false, skipped: true, reason: "enrollment_not_found" };
  }

  const email = enrollment.student.email?.trim();
  if (!email) {
    return { sent: false, queued: false, skipped: true, reason: "no_email" };
  }

  const { subject, html } = templateEnrollmentCancelled({
    name: enrollment.student.name,
    courseName: enrollment.classGroup.course.name,
    classGroupLabel: formatClassGroupLabel(enrollment.classGroup),
    loginUrl: getAppUrl("/login"),
    supportUrl: getAppUrl("/suporte"),
    cause: params.cause ?? "attendance",
  });

  return sendOrQueueEnrollmentEmail({
    enrollmentId: enrollment.id,
    to: email,
    subject,
    html,
    emailType: ENROLLMENT_CANCELLED_EMAIL_TYPE,
    performedByUserId: params.performedByUserId,
  });
}
