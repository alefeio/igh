import type { AttendanceMark } from "@/lib/attendance-mark";

export const CONSECUTIVE_UNJUSTIFIED_ABSENCE_LIMIT = 3;
export const CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT = 4;

export function isUnjustifiedAbsence(row: {
  present: boolean;
  absenceJustification: string | null;
}): boolean {
  if (row.present) return false;
  return (row.absenceJustification ?? "").trim().length === 0;
}

/**
 * Conta faltas consecutivas sem justificativa entre sessões já lançadas,
 * da mais recente para trás. Sessões liberadas sem lançamento são ignoradas
 * (não interrompem a sequência — evita zerar o streak quando há aulas futuras).
 */
export function countConsecutiveUnjustifiedAbsenceStreak(
  sessionsNewestFirst: { id: string }[],
  attendanceBySessionId: Map<string, { present: boolean; absenceJustification: string | null }>,
): number {
  let streak = 0;
  for (const session of sessionsNewestFirst) {
    const row = attendanceBySessionId.get(session.id);
    if (!row) continue;
    if (isUnjustifiedAbsence(row)) streak += 1;
    else break;
  }
  return streak;
}

function markToAttendanceRow(mark: AttendanceMark | null): {
  present: boolean;
  absenceJustification: string | null;
} | null {
  if (!mark) return null;
  if (mark === "P") return { present: true, absenceJustification: null };
  if (mark === "J") return { present: false, absenceJustification: "J" };
  return { present: false, absenceJustification: null };
}

/** Streak após aplicar `next` na sessão, usando as células da grade (sessões da mais antiga para a mais nova). */
export function simulatedUnjustifiedAbsenceStreak(params: {
  sessionsOldestFirst: { id: string }[];
  cells: Record<string, AttendanceMark | null>;
  sessionId: string;
  next: AttendanceMark | null;
}): number {
  const simulated = { ...params.cells, [params.sessionId]: params.next };
  const newestFirst = [...params.sessionsOldestFirst].reverse();
  const bySession = new Map<string, { present: boolean; absenceJustification: string | null }>();
  for (const session of newestFirst) {
    const row = markToAttendanceRow(simulated[session.id] ?? null);
    if (row) bySession.set(session.id, row);
  }
  return countConsecutiveUnjustifiedAbsenceStreak(newestFirst, bySession);
}

/** 4ª falta consecutiva sem justificativa, depois da suspensão automática. */
export function wouldCancelEnrollmentOnFourthAbsence(params: {
  enrollmentStatus: string;
  sessionsOldestFirst: { id: string }[];
  cells: Record<string, AttendanceMark | null>;
  sessionId: string;
  next: AttendanceMark | null;
}): boolean {
  if (params.enrollmentStatus !== "SUSPENDED") return false;
  if (params.next !== "F") return false;
  if ((params.cells[params.sessionId] ?? null) === "F") return false;
  return (
    simulatedUnjustifiedAbsenceStreak(params) >= CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT
  );
}
