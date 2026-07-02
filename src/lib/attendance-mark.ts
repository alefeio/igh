/** Marca de frequência na grade do professor (P/F/J). */
export type AttendanceMark = "P" | "F" | "J";

export const JUSTIFIED_ABSENCE_DEFAULT = "FJ";

export function rowToMark(row: {
  present: boolean;
  absenceJustification: string | null;
} | null | undefined): AttendanceMark | null {
  if (!row) return null;
  if (row.present) return "P";
  const j = (row.absenceJustification ?? "").trim();
  if (j.length > 0) return "J";
  return "F";
}

export function markToDb(mark: AttendanceMark): {
  present: boolean;
  absenceJustification: string | null;
} {
  if (mark === "P") return { present: true, absenceJustification: null };
  if (mark === "J") return { present: false, absenceJustification: JUSTIFIED_ABSENCE_DEFAULT };
  return { present: false, absenceJustification: null };
}

export function nextAttendanceMark(current: AttendanceMark | null): AttendanceMark {
  if (!current) return "P";
  if (current === "P") return "F";
  if (current === "J") return "P";
  return "J";
}

export function attendancePercent(presentCount: number, totalSessions: number): number | null {
  if (totalSessions <= 0) return null;
  return Math.round((presentCount / totalSessions) * 1000) / 10;
}
