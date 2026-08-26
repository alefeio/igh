import "server-only";

import { after } from "next/server";

import { createAuditLog } from "@/lib/audit";
import {
  CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT,
  CONSECUTIVE_UNJUSTIFIED_ABSENCE_LIMIT,
  countConsecutiveUnjustifiedAbsenceStreak,
  isUnjustifiedAbsence,
} from "@/lib/enrollment-attendance-streak";
import { sendEnrollmentCancellationEmail, sendEnrollmentSuspensionEmail } from "@/lib/enrollment-suspension-email";
import { sendEnrollmentWelcomeForStudent } from "@/lib/enrollment-welcome-email";
import { tryPromoteWaitlistAfterSeatFreed } from "@/lib/enrollment-waitlist";
import { notifyTeachersOfWaitlistEnrollment } from "@/lib/waitlist-teacher-notifications";
import { prisma } from "@/lib/prisma";

export {
  CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT,
  CONSECUTIVE_UNJUSTIFIED_ABSENCE_LIMIT,
  countConsecutiveUnjustifiedAbsenceStreak,
  isUnjustifiedAbsence,
};

/** Faltas consecutivas sem justificativa, da aula mais recente para trás (sessões liberadas). */
export async function getConsecutiveUnjustifiedAbsenceStreak(
  enrollmentId: string,
  classGroupId: string
): Promise<number> {
  const sessions = await prisma.classSession.findMany({
    where: { classGroupId, status: "LIBERADA" },
    orderBy: [{ sessionDate: "desc" }, { startTime: "desc" }],
    select: { id: true },
  });
  if (sessions.length === 0) return 0;

  const sessionIds = sessions.map((s) => s.id);
  const attendances = await prisma.sessionAttendance.findMany({
    where: { enrollmentId, classSessionId: { in: sessionIds } },
    select: { classSessionId: true, present: true, absenceJustification: true },
  });
  const bySession = new Map(attendances.map((a) => [a.classSessionId, a]));

  return countConsecutiveUnjustifiedAbsenceStreak(sessions, bySession);
}

type AttendancePatchRow = {
  enrollmentId: string;
  present: boolean;
  absenceJustification: string | null;
  /** Grade: P/F/J ou null (desmarcar). Ausente nas APIs que só enviam presença. */
  appliedMark?: "P" | "F" | "J" | null;
};

/**
 * Após salvar frequência: reativa matrícula suspensa com presença; suspende após 3 faltas
 * consecutivas sem justificativa; cancela após a 4ª falta consecutiva (já suspenso).
 */
export async function applyAttendanceSuspensionRules(params: {
  classGroupId: string;
  rows: AttendancePatchRow[];
  performedByUserId?: string | null;
}): Promise<{ reactivatedIds: string[]; suspendedIds: string[]; cancelledIds: string[] }> {
  const reactivatedIds: string[] = [];
  const suspendedIds: string[] = [];
  const cancelledIds: string[] = [];

  for (const row of params.rows) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: row.enrollmentId, classGroupId: params.classGroupId },
      select: { id: true, status: true, student: { select: { name: true } } },
    });
    if (!enrollment) continue;

    if (row.present && enrollment.status === "SUSPENDED") {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "ACTIVE" },
      });
      reactivatedIds.push(enrollment.id);
      await createAuditLog({
        entityType: "Enrollment",
        entityId: enrollment.id,
        action: "AUTO_REACTIVATE_ATTENDANCE",
        performedByUserId: params.performedByUserId ?? null,
        diff: {
          reason: "Presença registrada na aula presencial",
          studentName: enrollment.student.name,
        },
      });
      continue;
    }

    const streak = await getConsecutiveUnjustifiedAbsenceStreak(enrollment.id, params.classGroupId);
    const markingUnjustifiedAbsence =
      row.appliedMark === undefined
        ? isUnjustifiedAbsence(row)
        : row.appliedMark === "F";

    if (
      enrollment.status === "SUSPENDED" &&
      markingUnjustifiedAbsence &&
      streak >= CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT
    ) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "CANCELLED" },
      });
      cancelledIds.push(enrollment.id);

      // Promoção da fila imediatamente após liberar a vaga — não pode depender de audit/e-mail.
      // (Antes ficava no mesmo try do audit/`after`; falha no audit impedia a promoção.)
      let waitlist: { promoted: boolean; enrollmentId?: string; studentId?: string } = {
        promoted: false,
      };
      try {
        waitlist = await tryPromoteWaitlistAfterSeatFreed(
          params.classGroupId,
          params.performedByUserId,
          { skipNotifications: true },
        );
      } catch (e) {
        console.error("[attendance] promoção da fila após cancelamento", enrollment.id, e);
      }

      try {
        await createAuditLog({
          entityType: "Enrollment",
          entityId: enrollment.id,
          action: "AUTO_CANCEL_ATTENDANCE",
          performedByUserId: params.performedByUserId ?? null,
          diff: {
            reason: `${CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT} faltas consecutivas sem justificativa`,
            consecutiveUnjustifiedAbsences: streak,
            studentName: enrollment.student.name,
            waitlistPromoted: waitlist.promoted,
            waitlistEnrollmentId: waitlist.enrollmentId ?? null,
          },
        });
      } catch (e) {
        console.error("[attendance] audit após cancelamento", enrollment.id, e);
      }

      try {
        after(() => {
          void (async () => {
            try {
              await sendEnrollmentCancellationEmail({
                enrollmentId: enrollment.id,
                performedByUserId: params.performedByUserId,
                cause: "attendance",
              });
              if (waitlist.promoted && waitlist.enrollmentId && waitlist.studentId) {
                await sendEnrollmentWelcomeForStudent({
                  studentId: waitlist.studentId,
                  enrollmentId: waitlist.enrollmentId,
                  performedByUserId: params.performedByUserId,
                  emailType: "welcome_student_waitlist",
                  auditExtra: { fromWaitlist: true },
                });
                try {
                  await notifyTeachersOfWaitlistEnrollment(waitlist.enrollmentId);
                } catch (e) {
                  console.error("[attendance] notificar professor após waitlist", e);
                }
              } else {
                const { notifyWaitlistStudentsOfAlternateSeat } = await import(
                  "@/lib/waitlist-alternate-seat"
                );
                await notifyWaitlistStudentsOfAlternateSeat(
                  params.classGroupId,
                  params.performedByUserId,
                );
              }
            } catch (e) {
              console.error("[attendance] e-mails após cancelamento", enrollment.id, e);
            }
          })();
        });
      } catch (e) {
        console.error("[attendance] agendar e-mails após cancelamento", enrollment.id, e);
      }
      continue;
    }

    if (enrollment.status !== "ACTIVE") continue;

    if (markingUnjustifiedAbsence && streak >= CONSECUTIVE_UNJUSTIFIED_ABSENCE_LIMIT) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "SUSPENDED" },
      });
      suspendedIds.push(enrollment.id);
      try {
        await createAuditLog({
          entityType: "Enrollment",
          entityId: enrollment.id,
          action: "AUTO_SUSPEND_ATTENDANCE",
          performedByUserId: params.performedByUserId ?? null,
          diff: {
            reason: `${CONSECUTIVE_UNJUSTIFIED_ABSENCE_LIMIT} faltas consecutivas sem justificativa`,
            consecutiveUnjustifiedAbsences: streak,
            studentName: enrollment.student.name,
          },
        });
        after(() => {
          void sendEnrollmentSuspensionEmail({
            enrollmentId: enrollment.id,
            performedByUserId: params.performedByUserId,
            cause: "attendance",
          }).catch((e) => console.error("[attendance] e-mail após suspensão", enrollment.id, e));
        });
      } catch (e) {
        console.error("[attendance] efeito colateral após suspensão", enrollment.id, e);
      }
    }
  }

  return { reactivatedIds, suspendedIds, cancelledIds };
}
