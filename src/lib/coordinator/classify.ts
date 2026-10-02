import { COORDINATOR_THRESHOLDS } from "@/lib/coordinator/thresholds";
import type { ClassifiedEnrollment, EnrollmentSignalInput, JourneyKind } from "@/lib/coordinator/types";

function attendancePercent(input: EnrollmentSignalInput): number | null {
  if (input.heldSessions <= 0) return null;
  return Math.round((input.presentCount / input.heldSessions) * 100);
}

function started(input: EnrollmentSignalInput): boolean {
  return input.presentCount > 0;
}

/** Pré-matrícula sem confirmação não entra na coorte acadêmica. */
export function inAcademicCohort(input: EnrollmentSignalInput): boolean {
  if (input.isPreEnrollment && !input.confirmed) return false;
  return input.confirmed || !input.isPreEnrollment;
}

export function classifyJourney(input: EnrollmentSignalInput): JourneyKind {
  if (!inAcademicCohort(input)) return "PRE_ENROLLMENT";
  if (input.recordedReason === "TRANSFER") return "TRANSFERRED";
  if (input.recordedReason === "ADMINISTRATIVE") return "CANCELLED_ADMIN";
  if (input.status === "COMPLETED") return "COMPLETED";
  if (input.status === "SUSPENDED") return "SUSPENDED";

  const attended = started(input);
  const share = input.heldSessions > 0 ? input.presentCount / input.heldSessions : null;
  const cancelled = input.status === "CANCELLED";

  if (cancelled && !attended) {
    if (input.heldSessions <= 0) return "INSUFFICIENT_DATA";
    return "NO_SHOW";
  }
  if (cancelled && attended && share != null && share <= COORDINATOR_THRESHOLDS.earlyDropoutAttendanceShare) {
    return "EARLY_DROPOUT";
  }
  if (cancelled && attended) return "DROPOUT";
  if (cancelled) return "CANCELLED_UNCLASSIFIED";

  if (!attended && input.heldSessions > 0 && (input.confirmed || input.classClosed)) return "NO_SHOW";
  if (!attended && input.heldSessions <= 0) return "CONFIRMED_WAITING_CLASS";
  return "ACTIVE";
}

function riskReasons(input: EnrollmentSignalInput, kind: JourneyKind): { level: ClassifiedEnrollment["riskLevel"]; reasons: string[] } {
  if (input.status === "CANCELLED" || input.status === "COMPLETED") {
    return { level: null, reasons: [] };
  }
  if (kind === "PRE_ENROLLMENT" || kind === "COMPLETED" || kind === "TRANSFERRED" || kind === "CANCELLED_ADMIN") {
    return { level: null, reasons: [] };
  }
  if (kind === "DROPOUT" || kind === "EARLY_DROPOUT" || kind === "CANCELLED_UNCLASSIFIED") {
    return { level: null, reasons: [] };
  }

  const reasons: string[] = [];
  let level: ClassifiedEnrollment["riskLevel"] = null;
  const bump = (next: "CRITICAL" | "WARNING" | "ATTENTION") => {
    const rank = { CRITICAL: 3, WARNING: 2, ATTENTION: 1 };
    if (!level || rank[next] > rank[level]) level = next;
  };

  if (kind === "NO_SHOW") {
    reasons.push("Confirmou a matrícula e não compareceu a nenhuma aula já realizada");
    bump("CRITICAL");
  }
  if (input.consecutiveAbsences >= COORDINATOR_THRESHOLDS.consecutiveAbsencesCritical) {
    reasons.push(`${input.consecutiveAbsences} faltas consecutivas`);
    bump("CRITICAL");
  } else if (input.consecutiveAbsences >= COORDINATOR_THRESHOLDS.consecutiveAbsencesWarning) {
    reasons.push(`${input.consecutiveAbsences} faltas consecutivas`);
    bump("WARNING");
  }

  const percent = attendancePercent(input);
  if (percent != null && percent < COORDINATOR_THRESHOLDS.attendanceCriticalPercent) {
    reasons.push(`Frequência de ${percent}%`);
    bump("CRITICAL");
  } else if (percent != null && percent < COORDINATOR_THRESHOLDS.attendanceRiskPercent) {
    reasons.push(`Frequência de ${percent}%`);
    bump("WARNING");
  }

  if (input.progressPercent != null && input.progressPercent < COORDINATOR_THRESHOLDS.progressAttentionPercent) {
    reasons.push(`Progresso no conteúdo de ${input.progressPercent}%`);
    bump("ATTENTION");
  }
  if (input.lmsInactiveDays != null && input.lmsInactiveDays >= COORDINATOR_THRESHOLDS.lmsInactiveDays) {
    reasons.push(`Nenhum acesso ao conteúdo há ${input.lmsInactiveDays} dias`);
    bump("ATTENTION");
  }
  if (input.scorePercent != null && input.scorePercent < COORDINATOR_THRESHOLDS.scoreAttentionPercent) {
    reasons.push(`Aproveitamento nas provas de ${input.scorePercent}%`);
    bump("ATTENTION");
  }
  if (kind === "SUSPENDED") {
    reasons.push("Matrícula suspensa");
    bump("WARNING");
  }

  return { level, reasons };
}

export function classifyEnrollment(input: EnrollmentSignalInput): ClassifiedEnrollment {
  const kind = classifyJourney(input);
  const risk = riskReasons(input, kind);
  return {
    id: input.id,
    studentName: input.studentName,
    kind,
    inAcademicCohort: inAcademicCohort(input),
    started: started(input),
    riskLevel: risk.level,
    riskReasons: risk.reasons,
    attendancePercent: attendancePercent(input),
  };
}

export function countConsecutiveAbsences(
  marks: { date: string; present: boolean | null }[],
): number {
  const ordered = [...marks].sort((a, b) => a.date.localeCompare(b.date));
  let count = 0;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const mark = ordered[index];
    if (mark.present == null) continue;
    if (mark.present) break;
    count += 1;
  }
  return count;
}
