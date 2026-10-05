import { formatDaysOrderedPt } from "@/lib/turma-display";

export type VacancyClassGroup = {
  id: string;
  startDate: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  capacity?: number;
  location?: string | null;
  teacher?: { name: string } | null;
  teachers?: { name: string }[];
  poloLocation?: {
    id: string;
    name: string;
    polo?: { id: string; name: string } | null;
  } | null;
  course: { id: string; name: string };
};

export type EnrollmentVacancyRow = {
  courseName: string;
  startDate: string;
  schedule: string;
  days: string;
  turmaLabel: string;
  location: string;
  teacher: string;
  enrolled: number;
  graduated: number;
  capacity: number;
  active: number;
  cancelled: number;
  occupancyPercent: number | null;
};

export function classGroupLocationLabel(cg: VacancyClassGroup): string {
  const polo = cg.poloLocation?.polo?.name?.trim();
  const loc = cg.poloLocation?.name?.trim() || cg.location?.trim();
  if (polo && loc && polo !== loc) return `${polo} · ${loc}`;
  return loc || polo || "—";
}

export function classGroupTeacherLabel(cg: VacancyClassGroup): string {
  const names = new Set<string>();
  if (cg.teacher?.name?.trim()) names.add(cg.teacher.name.trim());
  for (const teacher of cg.teachers ?? []) {
    if (teacher.name?.trim()) names.add(teacher.name.trim());
  }
  return names.size > 0 ? [...names].join(", ") : "—";
}

export function formatVacancyDate(value: string, formatDateOnly: (v: string) => string): string {
  const formatted = formatDateOnly(value);
  return formatted || "—";
}

/** Monta as linhas no formato do relatório de vagas por curso e turma. */
export function buildEnrollmentVacancyRows(
  courses: Array<
    [
      string,
      {
        courseName: string;
        turmas: {
          classGroup: VacancyClassGroup;
          count: number;
          active: number;
          cancelled: number;
          completed: number;
        }[];
      },
    ]
  >,
  formatDateOnly: (v: string) => string,
): EnrollmentVacancyRow[] {
  const rows: EnrollmentVacancyRow[] = [];
  for (const [, { courseName, turmas }] of courses) {
    turmas.forEach((turma, index) => {
      const cg = turma.classGroup;
      const capacity = cg.capacity ?? 0;
      rows.push({
        courseName,
        startDate: formatVacancyDate(cg.startDate, formatDateOnly),
        schedule: `${cg.startTime}-${cg.endTime}`,
        days: Array.isArray(cg.daysOfWeek) && cg.daysOfWeek.length ? formatDaysOrderedPt(cg.daysOfWeek) : "—",
        turmaLabel: `Turma ${String(index + 1).padStart(2, "0")}`,
        location: classGroupLocationLabel(cg),
        teacher: classGroupTeacherLabel(cg),
        enrolled: turma.count,
        graduated: turma.completed,
        capacity,
        active: turma.active,
        cancelled: turma.cancelled,
        occupancyPercent: capacity > 0 ? Math.round((turma.count / capacity) * 100) : null,
      });
    });
  }
  return rows;
}

export function summarizeVacanciesByCourse(rows: EnrollmentVacancyRow[]) {
  const map = new Map<
    string,
    { courseName: string; enrolled: number; graduated: number; capacity: number; classes: number }
  >();
  for (const row of rows) {
    const current = map.get(row.courseName) ?? {
      courseName: row.courseName,
      enrolled: 0,
      graduated: 0,
      capacity: 0,
      classes: 0,
    };
    current.enrolled += row.enrolled;
    current.graduated += row.graduated;
    current.capacity += row.capacity;
    current.classes += 1;
    map.set(row.courseName, current);
  }
  return [...map.values()].sort((a, b) => a.courseName.localeCompare(b.courseName, "pt-BR"));
}

export function summarizeVacanciesByTeacher(rows: EnrollmentVacancyRow[]) {
  const map = new Map<string, { teacher: string; enrolled: number; graduated: number; classes: number }>();
  for (const row of rows) {
    const key = row.teacher || "—";
    const current = map.get(key) ?? { teacher: key, enrolled: 0, graduated: 0, classes: 0 };
    current.enrolled += row.enrolled;
    current.graduated += row.graduated;
    current.classes += 1;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.enrolled - a.enrolled || a.teacher.localeCompare(b.teacher, "pt-BR"));
}

export function summarizeVacanciesByLocation(rows: EnrollmentVacancyRow[]) {
  const map = new Map<string, { location: string; enrolled: number; graduated: number; classes: number }>();
  for (const row of rows) {
    const key = row.location || "—";
    const current = map.get(key) ?? { location: key, enrolled: 0, graduated: 0, classes: 0 };
    current.enrolled += row.enrolled;
    current.graduated += row.graduated;
    current.classes += 1;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.enrolled - a.enrolled || a.location.localeCompare(b.location, "pt-BR"));
}
