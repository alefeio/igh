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
  unmarkedCount: number;
  presentRate: number | null;
  justifiedRate: number | null;
  unjustifiedRate: number | null;
};

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

/**
 * Taxas de frequência sobre oportunidades elegíveis (aluno × sessão).
 * Sessão sem lançamento conta como oportunidade não marcada (não é presença).
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
  return {
    opportunities,
    presentCount,
    justifiedCount,
    unjustifiedCount,
    unmarkedCount,
    presentRate: rate(presentCount, opportunities),
    justifiedRate: rate(justifiedCount, opportunities),
    unjustifiedRate: rate(unjustifiedCount, opportunities),
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
  return {
    ...sum,
    presentRate: rate(sum.presentCount, sum.opportunities),
    justifiedRate: rate(sum.justifiedCount, sum.opportunities),
    unjustifiedRate: rate(sum.unjustifiedCount, sum.opportunities),
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
    if (!row) continue; // não lançada: não interrompe nem incrementa (alinhado ao streak operacional)
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
