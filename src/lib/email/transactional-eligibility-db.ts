import "server-only";

import { prisma } from "@/lib/prisma";
import {
  CONFIRMED_ENROLLMENT_STATUSES,
  evaluateWaitlistAlternateOfferEligibility,
  evaluateWelcomeEmailEligibility,
  parseWaitlistOfferEntityId,
  type EligibilityDecision,
} from "./transactional-eligibility";

export async function checkWelcomeEmailEligibility(args: {
  enrollmentId: string;
  recipientEmail: string;
  expectedStudentId?: string;
}): Promise<EligibilityDecision> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: args.enrollmentId },
    select: {
      studentId: true,
      status: true,
      isPreEnrollment: true,
      student: { select: { id: true, deletedAt: true, email: true } },
    },
  });

  if (args.expectedStudentId && enrollment && enrollment.studentId !== args.expectedStudentId) {
    return { eligible: false, reason: "enrollment_student_mismatch" };
  }

  return evaluateWelcomeEmailEligibility({
    recipientEmail: args.recipientEmail,
    student: enrollment?.student ?? null,
    enrollment: enrollment
      ? {
          studentId: enrollment.studentId,
          status: enrollment.status,
          isPreEnrollment: enrollment.isPreEnrollment,
        }
      : null,
  });
}

export async function studentHasConfirmedEnrollmentInCourse(args: {
  studentId: string;
  courseId: string;
}): Promise<boolean> {
  const found = await prisma.enrollment.findFirst({
    where: {
      studentId: args.studentId,
      isPreEnrollment: false,
      status: { in: [...CONFIRMED_ENROLLMENT_STATUSES] },
      classGroup: { courseId: args.courseId },
    },
    select: { id: true },
  });
  return Boolean(found);
}

export async function checkWaitlistAlternateOfferEligibility(args: {
  classGroupId: string;
  studentId: string;
  recipientEmail: string;
  sourceWaitlistId?: string | null;
}): Promise<EligibilityDecision> {
  const [student, classGroup, sourceWaitlist] = await Promise.all([
    prisma.student.findUnique({
      where: { id: args.studentId },
      select: { id: true, deletedAt: true, email: true },
    }),
    prisma.classGroup.findUnique({
      where: { id: args.classGroupId },
      select: { courseId: true },
    }),
    args.sourceWaitlistId
      ? prisma.enrollmentWaitlist.findUnique({
          where: { id: args.sourceWaitlistId },
          select: { status: true, studentId: true },
        })
      : prisma.enrollmentWaitlist.findFirst({
          where: {
            studentId: args.studentId,
            status: "WAITING",
            classGroup: { id: { not: args.classGroupId } },
          },
          select: { status: true, studentId: true },
        }),
  ]);

  const waitlistStatus =
    sourceWaitlist && sourceWaitlist.studentId === args.studentId
      ? sourceWaitlist.status
      : null;

  const hasConfirmedEnrollmentInCourse = classGroup
    ? await studentHasConfirmedEnrollmentInCourse({
        studentId: args.studentId,
        courseId: classGroup.courseId,
      })
    : true;

  return evaluateWaitlistAlternateOfferEligibility({
    recipientEmail: args.recipientEmail,
    student,
    waitlistStatus,
    hasConfirmedEnrollmentInCourse,
  });
}

export async function checkOutboxRowEligibility(row: {
  emailType: string;
  entityType: string | null;
  entityId: string | null;
  to: string;
}): Promise<EligibilityDecision> {
  const isWelcome =
    row.entityType === "Enrollment" &&
    Boolean(row.entityId) &&
    (row.emailType === "welcome_student" || row.emailType === "welcome_student_waitlist");

  if (isWelcome && row.entityId) {
    return checkWelcomeEmailEligibility({
      enrollmentId: row.entityId,
      recipientEmail: row.to,
    });
  }

  if (row.emailType === "waitlist_alternate_seat_offer") {
    const parsed = parseWaitlistOfferEntityId(row.entityId);
    if (!parsed) return { eligible: false, reason: "invalid_entity" };

    const offer = await prisma.waitlistSeatOffer.findUnique({
      where: {
        studentId_classGroupId: {
          studentId: parsed.studentId,
          classGroupId: parsed.classGroupId,
        },
      },
      select: { sourceWaitlistId: true, status: true },
    });

    return checkWaitlistAlternateOfferEligibility({
      classGroupId: parsed.classGroupId,
      studentId: parsed.studentId,
      recipientEmail: row.to,
      sourceWaitlistId: offer?.sourceWaitlistId,
    });
  }

  return { eligible: true };
}
