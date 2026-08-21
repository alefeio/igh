import { isUnjustifiedAbsence } from "@/lib/enrollment-attendance-streak";
import {
  filterEligibleSessionsForEnrollment,
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
 * - Streak ignora sessões sem lançamento (não incrementa nem zera o streak).
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

/** Streak de faltas não justificadas nas sessões elegíveis (mais recente → antiga). */
export function countUnjustifiedStreakEligible(
  enrollment: EnrollmentEntryLike,
  sessions: SessionLike[],
  attendanceBySessionId: Map<string, AttendanceMarkRow>,
  dataAsOf: Date,
): number {
  const newestFirst = filterEligibleSessionsForEnrollment(
    sessions,
    enrollment,
    dataAsOf,
    "desc",
  );
  let streak = 0;
  for (const s of newestFirst) {
    const row = attendanceBySessionId.get(s.id);
    // Chamada incompleta: não incrementa e não interrompe (mesmo critério operacional).
    if (!row) continue;
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

export function classifyCriticalAbsenceRisk(params: {
  status: string;
  streak: number;
  cancelLimit: number;
}): "none" | "critical_linked" {
  if (params.status !== "ACTIVE" && params.status !== "SUSPENDED") return "none";
  if (params.streak >= params.cancelLimit) return "critical_linked";
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
