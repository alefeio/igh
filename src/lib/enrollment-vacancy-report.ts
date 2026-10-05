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
    polo?: {
      id: string;
      name: string;
      coordinator?: { name: string } | null;
    } | null;
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
  locationKey: string;
  locationName: string;
  locationHeader: string;
  poloName: string | null;
  coordinatorName: string | null;
  teacher: string;
  enrolled: number;
  graduated: number;
  capacity: number;
  active: number;
  cancelled: number;
  occupancyPercent: number | null;
};

export type VacancyLocationSection = {
  locationKey: string;
  locationHeader: string;
  locationName: string;
  poloName: string | null;
  coordinatorName: string | null;
  rows: EnrollmentVacancyRow[];
  subtotal: {
    enrolled: number;
    graduated: number;
    capacity: number;
    available: number;
  };
};

export function classGroupLocationLabel(cg: VacancyClassGroup): string {
  const polo = cg.poloLocation?.polo?.name?.trim();
  const loc = cg.poloLocation?.name?.trim() || cg.location?.trim();
  if (polo && loc && polo !== loc) return `${polo} · ${loc}`;
  return loc || polo || "—";
}

export function buildVacancyLocationMeta(cg: VacancyClassGroup): {
  locationKey: string;
  locationName: string;
  poloName: string | null;
  coordinatorName: string | null;
  locationHeader: string;
  location: string;
} {
  const poloName = cg.poloLocation?.polo?.name?.trim() || null;
  const locationName = cg.poloLocation?.name?.trim() || cg.location?.trim() || "Sem local";
  const coordinatorName = cg.poloLocation?.polo?.coordinator?.name?.trim() || null;
  const locationKey = cg.poloLocation?.id ?? `legacy:${locationName.toLowerCase()}`;

  const aside: string[] = [];
  if (poloName) aside.push(`Polo: ${poloName}`);
  if (coordinatorName) aside.push(`Coordenador: ${coordinatorName}`);
  const locationHeader = aside.length > 0 ? `${locationName} — ${aside.join(" | ")}` : locationName;

  return {
    locationKey,
    locationName,
    poloName,
    coordinatorName,
    locationHeader,
    location: classGroupLocationLabel(cg),
  };
}

/** Une dados completos da turma (API de turmas) com recortes parciais das matrículas. */
export function mergeVacancyClassGroup(
  partial: VacancyClassGroup,
  catalog?: VacancyClassGroup | null,
): VacancyClassGroup {
  if (!catalog) return partial;
  return {
    ...catalog,
    ...partial,
    course: partial.course?.id ? partial.course : catalog.course,
    teacher: catalog.teacher ?? partial.teacher,
    teachers: catalog.teachers?.length ? catalog.teachers : partial.teachers,
    poloLocation: catalog.poloLocation ?? partial.poloLocation,
    location: catalog.location ?? partial.location,
    capacity: partial.capacity ?? catalog.capacity,
  };
}

export function classGroupTeacherLabel(cg: VacancyClassGroup): string {
  const names = new Set<string>();
  if (cg.teacher?.name?.trim()) names.add(cg.teacher.name.trim());
  for (const teacher of cg.teachers ?? []) {
    if (teacher.name?.trim()) names.add(teacher.name.trim());
  }
  return names.size > 0 ? [...names].join(", ") : "Não informado";
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
  catalogById?: Map<string, VacancyClassGroup>,
): EnrollmentVacancyRow[] {
  const rows: EnrollmentVacancyRow[] = [];
  for (const [, { courseName, turmas }] of courses) {
    turmas.forEach((turma, index) => {
      const cg = mergeVacancyClassGroup(turma.classGroup, catalogById?.get(turma.classGroup.id));
      const capacity = cg.capacity ?? 0;
      const locationMeta = buildVacancyLocationMeta(cg);
      rows.push({
        courseName,
        startDate: formatVacancyDate(cg.startDate, formatDateOnly),
        schedule: `${cg.startTime}-${cg.endTime}`,
        days: Array.isArray(cg.daysOfWeek) && cg.daysOfWeek.length ? formatDaysOrderedPt(cg.daysOfWeek) : "—",
        turmaLabel: `Turma ${String(index + 1).padStart(2, "0")}`,
        location: locationMeta.location,
        locationKey: locationMeta.locationKey,
        locationName: locationMeta.locationName,
        locationHeader: locationMeta.locationHeader,
        poloName: locationMeta.poloName,
        coordinatorName: locationMeta.coordinatorName,
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

export function groupVacancyRowsByLocation(rows: EnrollmentVacancyRow[]): VacancyLocationSection[] {
  const map = new Map<string, VacancyLocationSection>();
  for (const row of rows) {
    let section = map.get(row.locationKey);
    if (!section) {
      section = {
        locationKey: row.locationKey,
        locationHeader: row.locationHeader,
        locationName: row.locationName,
        poloName: row.poloName,
        coordinatorName: row.coordinatorName,
        rows: [],
        subtotal: { enrolled: 0, graduated: 0, capacity: 0, available: 0 },
      };
      map.set(row.locationKey, section);
    }
    section.rows.push(row);
    section.subtotal.enrolled += row.enrolled;
    section.subtotal.graduated += row.graduated;
    section.subtotal.capacity += row.capacity;
  }

  for (const section of map.values()) {
    section.subtotal.available = Math.max(0, section.subtotal.capacity - section.subtotal.enrolled);
    section.rows.sort((a, b) => {
      const byCourse = a.courseName.localeCompare(b.courseName, "pt-BR");
      if (byCourse !== 0) return byCourse;
      const byDate = a.startDate.localeCompare(b.startDate, "pt-BR");
      if (byDate !== 0) return byDate;
      return a.schedule.localeCompare(b.schedule, "pt-BR");
    });
  }

  return [...map.values()].sort(
    (a, b) =>
      a.locationName.localeCompare(b.locationName, "pt-BR") ||
      (a.poloName ?? "").localeCompare(b.poloName ?? "", "pt-BR"),
  );
}

/** Planilha no formato do documento de referência (blocos por local). */
export function buildVacancyLocationSheetRows(sections: VacancyLocationSection[]): unknown[][] {
  const out: unknown[][] = [];
  for (const section of sections) {
    out.push([section.locationHeader.toUpperCase()]);
    out.push(["Início", "Horários", "Dias", "Turma", "Professor", "Matriculados", "Formados"]);
    for (const row of section.rows) {
      out.push([
        row.startDate,
        row.schedule,
        row.days,
        row.turmaLabel,
        row.teacher,
        row.enrolled,
        row.graduated,
      ]);
    }
    out.push([
      `Subtotal: ${section.subtotal.enrolled} matriculados | Capacidade: ${section.subtotal.capacity} | Vagas disponíveis: ${section.subtotal.available}`,
    ]);
    out.push([]);
  }
  return out;
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
    const key = row.teacher || "Não informado";
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
    const key = row.locationHeader || row.location || "—";
    const current = map.get(key) ?? { location: key, enrolled: 0, graduated: 0, classes: 0 };
    current.enrolled += row.enrolled;
    current.graduated += row.graduated;
    current.classes += 1;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.enrolled - a.enrolled || a.location.localeCompare(b.location, "pt-BR"));
}
