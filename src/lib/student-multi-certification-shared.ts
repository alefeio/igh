/**
 * Regras do mural de multicertificados — seguras para testes e Client Components.
 */

export const MULTI_CERT_MIN_COURSES = 2;
/** Máximo de alunos com 2 certificações exibidos na home pública. */
export const MULTI_CERT_PUBLIC_SILVER_CAP = 24;
/** Máximo total na vitrine compacta do dashboard do aluno. */
export const MULTI_CERT_DASHBOARD_CAP = 12;

export type MultiCertTier = "silver" | "gold" | "platinum";

export type RawCertifiedEnrollment = {
  studentId: string;
  studentName: string;
  courseId: string;
  completedAt: Date | null;
};

export type AggregatedStudentCert = {
  studentId: string;
  studentName: string;
  certificationCount: number;
  courseIds: string[];
  lastCompletedAt: Date | null;
};

export type MultiCertifiedStudentEntry = {
  studentId: string;
  displayName: string;
  certificationCount: number;
  tier: MultiCertTier;
  lastCompletedAt: string | null;
};

export type MultiCertifiedShowcasePayload = {
  entries: MultiCertifiedStudentEntry[];
  totalEligible: number;
  hiddenCount: number;
};

export type StudentMultiCertProgress = {
  certificationCount: number;
  coursesNeededForMural: number;
  /** Certificados faltantes para a próxima faixa visual (ou null no topo). */
  coursesNeededForNextTier: number | null;
  isOnMural: boolean;
  tier: MultiCertTier | null;
  displayName: string;
};

export function tierFromCount(count: number): MultiCertTier {
  if (count >= 4) return "platinum";
  if (count >= 3) return "gold";
  return "silver";
}

export function aggregateCertifiedStudents(rows: RawCertifiedEnrollment[]): AggregatedStudentCert[] {
  const map = new Map<string, AggregatedStudentCert>();

  for (const row of rows) {
    let cur = map.get(row.studentId);
    if (!cur) {
      cur = {
        studentId: row.studentId,
        studentName: row.studentName,
        certificationCount: 0,
        courseIds: [],
        lastCompletedAt: null,
      };
      map.set(row.studentId, cur);
    }
    if (!cur.courseIds.includes(row.courseId)) {
      cur.courseIds.push(row.courseId);
      cur.certificationCount = cur.courseIds.length;
    }
    if (row.completedAt && (!cur.lastCompletedAt || row.completedAt > cur.lastCompletedAt)) {
      cur.lastCompletedAt = row.completedAt;
    }
  }

  return Array.from(map.values());
}

export function sortMultiCertStudents(students: AggregatedStudentCert[]): AggregatedStudentCert[] {
  return [...students].sort((a, b) => {
    if (b.certificationCount !== a.certificationCount) {
      return b.certificationCount - a.certificationCount;
    }
    const aTime = a.lastCompletedAt?.getTime() ?? 0;
    const bTime = b.lastCompletedAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}

/** Nome público: primeiro nome + inicial do sobrenome. */
export function formatMultiCertDisplayName(
  fullName: string,
  mode: "public" | "full",
): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Aluno";
  if (mode === "full") return parts.join(" ");
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() ?? "";
  return `${first} ${lastInitial}.`;
}

/** Evita colisão quando dois alunos abreviam igual (ex.: Victoria F. / Vitoria F.). */
export function assignMultiCertDisplayNames(
  students: AggregatedStudentCert[],
  mode: "public" | "full",
): Map<string, string> {
  const baseById = new Map<string, string>();
  for (const s of students) {
    baseById.set(s.studentId, formatMultiCertDisplayName(s.studentName, mode));
  }

  const baseCounts = new Map<string, number>();
  for (const base of baseById.values()) {
    baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
  }

  const used = new Set<string>();
  const result = new Map<string, string>();

  for (const s of students) {
    const parts = s.studentName.trim().split(/\s+/).filter(Boolean);
    let name = baseById.get(s.studentId) ?? "Aluno";

    if ((baseCounts.get(name) ?? 0) > 1 && parts.length >= 2 && mode === "public") {
      const last = parts[parts.length - 1];
      name = `${parts[0]} ${last.slice(0, 2).replace(/^./, (c) => c.toUpperCase())}.`;
    }

    let finalName = name;
    let suffix = 2;
    while (used.has(finalName)) {
      finalName = `${name} (${suffix})`;
      suffix += 1;
    }
    used.add(finalName);
    result.set(s.studentId, finalName);
  }

  return result;
}

export function toShowcaseEntries(
  students: AggregatedStudentCert[],
  displayNames: Map<string, string>,
): MultiCertifiedStudentEntry[] {
  return students.map((s) => ({
    studentId: s.studentId,
    displayName: displayNames.get(s.studentId) ?? formatMultiCertDisplayName(s.studentName, "public"),
    certificationCount: s.certificationCount,
    tier: tierFromCount(s.certificationCount),
    lastCompletedAt: s.lastCompletedAt ? s.lastCompletedAt.toISOString().slice(0, 10) : null,
  }));
}

export function selectForPublicShowcase(
  sorted: AggregatedStudentCert[],
  minCourses = MULTI_CERT_MIN_COURSES,
  silverCap = MULTI_CERT_PUBLIC_SILVER_CAP,
): { selected: AggregatedStudentCert[]; totalEligible: number; hiddenCount: number } {
  const eligible = sorted.filter((s) => s.certificationCount >= minCourses);
  const goldPlus = eligible.filter((s) => s.certificationCount >= 3);
  const silver = eligible.filter((s) => s.certificationCount === 2);
  const silverShown = silver.slice(0, silverCap);
  const selected = sortMultiCertStudents([...goldPlus, ...silverShown]);
  return {
    selected,
    totalEligible: eligible.length,
    hiddenCount: Math.max(0, eligible.length - selected.length),
  };
}

export function selectForDashboardShowcase(
  sorted: AggregatedStudentCert[],
  minCourses = MULTI_CERT_MIN_COURSES,
  cap = MULTI_CERT_DASHBOARD_CAP,
): AggregatedStudentCert[] {
  return sorted.filter((s) => s.certificationCount >= minCourses).slice(0, cap);
}

export function computeStudentMultiCertProgress(
  certificationCount: number,
  displayName: string,
): StudentMultiCertProgress {
  const isOnMural = certificationCount >= MULTI_CERT_MIN_COURSES;
  const coursesNeededForMural = Math.max(0, MULTI_CERT_MIN_COURSES - certificationCount);

  let coursesNeededForNextTier: number | null;
  if (certificationCount >= 4) {
    coursesNeededForNextTier = null;
  } else if (certificationCount >= 3) {
    coursesNeededForNextTier = 4 - certificationCount;
  } else if (certificationCount >= 2) {
    coursesNeededForNextTier = 3 - certificationCount;
  } else {
    coursesNeededForNextTier = coursesNeededForMural;
  }

  return {
    certificationCount,
    coursesNeededForMural,
    coursesNeededForNextTier,
    isOnMural,
    tier: isOnMural ? tierFromCount(certificationCount) : null,
    displayName,
  };
}
