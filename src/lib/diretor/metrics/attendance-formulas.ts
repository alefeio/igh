import { isUnjustifiedAbsence } from "@/lib/enrollment-attendance-streak";
import {
  filterEligibleSessionsForEnrollment,
  filterOccurredSessionsForEnrollment,
  type EnrollmentEntryLike,
  type SessionLike,
} from "@/lib/diretor/eligible-sessions";

export type AttendanceMarkRow = {
  classSessionId: string;
  present: boolean;
  absenceJustification: string | null;
};

export type OpportunityRates = {
  opportunities: number;
  presentCount: number;
  justifiedCount: number;
  unjustifiedCount: number;
  /** Oportunidades elegíveis sem lançamento de chamada — NÃO contam como falta. */
  unmarkedCount: number;
  markedCount: number;
  /** markedCount ÷ opportunities; null se opportunities=0. */
  callCompletenessRate: number | null;
  presentRate: number | null;
  justifiedRate: number | null;
  unjustifiedRate: number | null;
  /**
   * ok = todas as oportunidades marcadas;
   * partial = há chamada incompleta (unmarked>0);
   * unavailable = sem oportunidades.
   */
  quality: "ok" | "partial" | "unavailable";
};

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

function qualityFrom(opportunities: number, unmarkedCount: number): OpportunityRates["quality"] {
  if (opportunities <= 0) return "unavailable";
  if (unmarkedCount > 0) return "partial";
  return "ok";
}

/**
 * Taxas de frequência sobre oportunidades elegíveis (aluno × sessão).
 *
 * Regra de chamada incompleta (Fase 1A):
 * - Oportunidade sem `SessionAttendance` entra no denominador das taxas,
 *   mas **não** é convertida em falta justificada/não justificada.
 * - Completude da chamada = marcadas ÷ oportunidades.
 * - Qualidade = partial quando unmarkedCount > 0.
 * - Streak: sessão desconhecida (não liberada ou sem lançamento) interrompe a comprovação
 *   de continuidade; não é presença nem falta.
 */
export function computeOpportunityRates(
  enrollment: EnrollmentEntryLike,
  sessions: SessionLike[],
  attendanceBySessionId: Map<string, AttendanceMarkRow>,
  dataAsOf: Date,
): OpportunityRates {
  const eligible = filterEligibleSessionsForEnrollment(sessions, enrollment, dataAsOf, "asc");
  let presentCount = 0;
  let justifiedCount = 0;
  let unjustifiedCount = 0;
  let unmarkedCount = 0;

  for (const s of eligible) {
    const row = attendanceBySessionId.get(s.id);
    if (!row) {
      unmarkedCount += 1;
      continue;
    }
    if (row.present) {
      presentCount += 1;
      continue;
    }
    if ((row.absenceJustification ?? "").trim().length > 0) justifiedCount += 1;
    else unjustifiedCount += 1;
  }

  const opportunities = eligible.length;
  const markedCount = opportunities - unmarkedCount;
  return {
    opportunities,
    presentCount,
    justifiedCount,
    unjustifiedCount,
    unmarkedCount,
    markedCount,
    callCompletenessRate: rate(markedCount, opportunities),
    presentRate: rate(presentCount, opportunities),
    justifiedRate: rate(justifiedCount, opportunities),
    unjustifiedRate: rate(unjustifiedCount, opportunities),
    quality: qualityFrom(opportunities, unmarkedCount),
  };
}

export function aggregateOpportunityRates(rows: OpportunityRates[]): OpportunityRates {
  const sum = rows.reduce(
    (acc, r) => {
      acc.opportunities += r.opportunities;
      acc.presentCount += r.presentCount;
      acc.justifiedCount += r.justifiedCount;
      acc.unjustifiedCount += r.unjustifiedCount;
      acc.unmarkedCount += r.unmarkedCount;
      return acc;
    },
    {
      opportunities: 0,
      presentCount: 0,
      justifiedCount: 0,
      unjustifiedCount: 0,
      unmarkedCount: 0,
    },
  );
  const markedCount = sum.opportunities - sum.unmarkedCount;
  return {
    ...sum,
    markedCount,
    callCompletenessRate: rate(markedCount, sum.opportunities),
    presentRate: rate(sum.presentCount, sum.opportunities),
    justifiedRate: rate(sum.justifiedCount, sum.opportunities),
    unjustifiedRate: rate(sum.unjustifiedCount, sum.opportunities),
    quality: qualityFrom(sum.opportunities, sum.unmarkedCount),
  };
}

/** Streak comprovado de faltas não justificadas (mais recente → antiga). Lacuna desconhecida interrompe. */
export function countUnjustifiedStreakEligible(
  enrollment: EnrollmentEntryLike,
  sessions: SessionLike[],
  attendanceBySessionId: Map<string, AttendanceMarkRow>,
  dataAsOf: Date,
): number {
  const newestFirst = filterOccurredSessionsForEnrollment(sessions, enrollment, dataAsOf, "desc");
  let streak = 0;
  for (const s of newestFirst) {
    const row = attendanceBySessionId.get(s.id);
    const unknown = s.status !== "LIBERADA" || !row;
    if (unknown) break;
    if (isUnjustifiedAbsence(row)) streak += 1;
    else break;
  }
  return streak;
}

export function hasStarted(
  enrollment: EnrollmentEntryLike,
  sessions: SessionLike[],
  attendanceBySessionId: Map<string, AttendanceMarkRow>,
  dataAsOf: Date,
): boolean {
  const eligible = filterEligibleSessionsForEnrollment(sessions, enrollment, dataAsOf, "asc");
  for (const s of eligible) {
    const row = attendanceBySessionId.get(s.id);
    if (row?.present) return true;
  }
  return false;
}

/** Pessoas distintas (studentId) com pelo menos uma presença em sessão elegível. */
export function countServedUniqueStudents(
  enrollments: Array<{
    id: string;
    studentId: string;
    classGroupId: string;
    enrolledAt: Date;
    enrollmentConfirmedAt?: Date | null;
  }>,
  sessions: SessionLike[],
  attendanceByEnrollment: Map<string, Map<string, AttendanceMarkRow>>,
  dataAsOf: Date,
): number {
  const ids = new Set<string>();
  for (const e of enrollments) {
    const entry = { id: e.id, classGroupId: e.classGroupId, enteredAt: e.enrolledAt };
    if (hasStarted(entry, sessions, attendanceByEnrollment.get(e.id) ?? new Map(), dataAsOf)) {
      ids.add(e.studentId);
    }
  }
  return ids.size;
}

export function reconcileNonStart(enrollments: number, started: number): {
  notStarted: number;
  rate: number | null;
} {
  if (enrollments < 0 || started < 0) return { notStarted: 0, rate: null };
  const notStarted = Math.max(0, enrollments - started);
  return { notStarted, rate: rate(notStarted, enrollments) };
}

/** @deprecated 1C.1 — use reconcileNonStart */
export function reconcileConfirmedNonStart(confirmed: number, startedAmongConfirmed: number) {
  return reconcileNonStart(confirmed, startedAmongConfirmed);
}

/** Completude mínima para apresentar frequência como indicador executivo confiável. */
export const EXECUTIVE_CALL_COMPLETENESS_THRESHOLD = 90;

export function isExecutiveAttendanceReliable(callCompletenessRate: number | null): boolean {
  return callCompletenessRate != null && callCompletenessRate >= EXECUTIVE_CALL_COMPLETENESS_THRESHOLD;
}

export const INCOMPLETE_CALL_ALERT = {
  title: "Chamadas incompletas",
  fact: "Chamadas incompletas impedem uma leitura confiável da frequência.",
  suggestedDecision: "Solicitar a regularização das chamadas antes de avaliar a frequência.",
} as const;

/** Abaixo do limiar: não alimentar alertas nem comparações executivas de frequência. */
export function shouldEmitExecutiveAttendanceAlerts(callCompletenessRate: number | null): boolean {
  return isExecutiveAttendanceReliable(callCompletenessRate);
}

export function presenceDependentQuality(reliable: boolean): "ok" | "partial" {
  return reliable ? "ok" : "partial";
}

export const SOCIAL_PRESENCE_PARTIAL_NOTE =
  "Atendidos, novos, recorrentes e concluintes dependem dos registros de presença.";

export function classifyCriticalAbsenceRisk(params: {
  status: string;
  streak: number;
  cancelLimit: number;
}): "none" | "critical_linked" {
  if (params.status !== "ACTIVE" && params.status !== "SUSPENDED") return "none";
  if (params.streak >= 3 && params.streak < params.cancelLimit) return "critical_linked";
  return "none";
}

export function completionStartedRate(params: {
  classGroupStatus: string;
  startedCount: number;
  completedStartedCount: number;
}): number | null {
  if (params.classGroupStatus !== "ENCERRADA") return null;
  if (params.startedCount <= 0) return null;
  return rate(params.completedStartedCount, params.startedCount);
}
