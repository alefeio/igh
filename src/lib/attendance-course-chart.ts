/** Dados agregados por curso (todas as turmas somadas) — usado no gráfico e no PDF. */

export const MAX_COURSES_CHART = 48;

export type AttendanceCourseChartDatum = {
  courseName: string;
  present: number;
  absentSemJust: number;
  justificada: number;
};

export type AttendanceGroupForChart = {
  courseId: string;
  courseName: string;
  presentSum: number;
  absentSum: number;
  justifiedAbsentSum: number;
};

/**
 * Agrega turmas pelo curso e ordena por volume (presenças + ausências).
 */
export function aggregateAttendanceByCourse(groups: AttendanceGroupForChart[]): AttendanceCourseChartDatum[] {
  const map = new Map<string, AttendanceCourseChartDatum>();
  for (const g of groups) {
    const key = g.courseId || g.courseName;
    const absentSem = Math.max(0, g.absentSum - g.justifiedAbsentSum);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        courseName: g.courseName.trim(),
        present: g.presentSum,
        absentSemJust: absentSem,
        justificada: g.justifiedAbsentSum,
      });
    } else {
      existing.present += g.presentSum;
      existing.absentSemJust += absentSem;
      existing.justificada += g.justifiedAbsentSum;
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      b.present + b.absentSemJust + b.justificada - (a.present + a.absentSemJust + a.justificada),
  );
}

export function chartRowsForExport(
  groups: AttendanceGroupForChart[],
  maxCourses = MAX_COURSES_CHART
): { rows: AttendanceCourseChartDatum[]; truncated: boolean } {
  const all = aggregateAttendanceByCourse(groups);
  const truncated = all.length > maxCourses;
  return { rows: all.slice(0, maxCourses), truncated };
}
