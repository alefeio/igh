/** Status que indicam matrícula vigente (ocupa vaga). */
export const CONFIRMED_ENROLLMENT_STATUSES = ["ACTIVE", "SUSPENDED"] as const;

export type WelcomeEligibilityInput = {
  recipientEmail: string;
  student: { id: string; deletedAt: Date | null; email: string | null } | null;
  enrollment: {
    studentId: string;
    status: string;
    isPreEnrollment: boolean;
  } | null;
};

export type WaitlistAlternateEligibilityInput = {
  recipientEmail: string;
  student: { id: string; deletedAt: Date | null; email: string | null } | null;
  waitlistStatus: string | null;
  hasConfirmedEnrollmentInCourse: boolean;
};

export type EligibilityDecision = { eligible: true } | { eligible: false; reason: string };

function emailsMatch(studentEmail: string | null | undefined, recipientEmail: string): boolean {
  const a = studentEmail?.trim().toLowerCase() ?? "";
  const b = recipientEmail.trim().toLowerCase();
  return a.length > 0 && a === b;
}

export function isConfirmedEnrollment(enrollment: {
  status: string;
  isPreEnrollment: boolean;
}): boolean {
  if (enrollment.isPreEnrollment) return false;
  return (CONFIRMED_ENROLLMENT_STATUSES as readonly string[]).includes(enrollment.status);
}

export function evaluateWelcomeEmailEligibility(
  input: WelcomeEligibilityInput,
): EligibilityDecision {
  if (!input.student) {
    return { eligible: false, reason: "student_missing" };
  }
  if (input.student.deletedAt) {
    return { eligible: false, reason: "student_deleted" };
  }
  if (!emailsMatch(input.student.email, input.recipientEmail)) {
    return { eligible: false, reason: "recipient_mismatch" };
  }
  if (!input.enrollment) {
    return { eligible: false, reason: "enrollment_missing" };
  }
  if (input.enrollment.studentId !== input.student.id) {
    return { eligible: false, reason: "enrollment_student_mismatch" };
  }
  if (!isConfirmedEnrollment(input.enrollment)) {
    return { eligible: false, reason: "enrollment_not_confirmed" };
  }
  return { eligible: true };
}

export function evaluateWaitlistAlternateOfferEligibility(
  input: WaitlistAlternateEligibilityInput,
): EligibilityDecision {
  if (!input.student) {
    return { eligible: false, reason: "student_missing" };
  }
  if (input.student.deletedAt) {
    return { eligible: false, reason: "student_deleted" };
  }
  if (!emailsMatch(input.student.email, input.recipientEmail)) {
    return { eligible: false, reason: "recipient_mismatch" };
  }
  if (input.waitlistStatus !== "WAITING") {
    return { eligible: false, reason: "waitlist_not_waiting" };
  }
  if (input.hasConfirmedEnrollmentInCourse) {
    return { eligible: false, reason: "already_enrolled" };
  }
  return { eligible: true };
}

export function parseWaitlistOfferEntityId(
  entityId: string | null | undefined,
): { classGroupId: string; studentId: string } | null {
  if (!entityId) return null;
  const idx = entityId.indexOf(":");
  if (idx <= 0 || idx === entityId.length - 1) return null;
  return {
    classGroupId: entityId.slice(0, idx),
    studentId: entityId.slice(idx + 1),
  };
}
