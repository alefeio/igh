import "server-only";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { MULTI_CERT_CACHE_TAG } from "@/lib/student-multi-certification-cache";
import {
  aggregateCertifiedStudents,
  assignMultiCertDisplayNames,
  computeStudentMultiCertProgress,
  formatMultiCertDisplayName,
  selectForFeaturedShowcase,
  selectForFullShowcase,
  sortMultiCertStudents,
  toShowcaseEntries,
  MULTI_CERT_DASHBOARD_CAP,
  type AggregatedStudentCert,
  type MultiCertifiedShowcasePayload,
  type StudentMultiCertProgress,
} from "@/lib/student-multi-certification-shared";

type CachedStudentRow = {
  studentId: string;
  studentName: string;
  certificationCount: number;
  courseIds: string[];
  lastCompletedAt: string | null;
};

type CachedMultiCertSnapshot = {
  sorted: CachedStudentRow[];
  countByStudentId: Record<string, number>;
};

function toCachedRows(students: AggregatedStudentCert[]): CachedStudentRow[] {
  return students.map((s) => ({
    studentId: s.studentId,
    studentName: s.studentName,
    certificationCount: s.certificationCount,
    courseIds: s.courseIds,
    lastCompletedAt: s.lastCompletedAt ? s.lastCompletedAt.toISOString() : null,
  }));
}

function fromCachedRows(rows: CachedStudentRow[]): AggregatedStudentCert[] {
  return rows.map((s) => ({
    studentId: s.studentId,
    studentName: s.studentName,
    certificationCount: s.certificationCount,
    courseIds: s.courseIds,
    lastCompletedAt: s.lastCompletedAt ? new Date(s.lastCompletedAt) : null,
  }));
}

async function fetchCertifiedEnrollmentRows() {
  return prisma.enrollment.findMany({
    where: {
      certificateEligible: true,
      student: { deletedAt: null },
      classGroup: { status: "ENCERRADA" },
    },
    select: {
      studentId: true,
      student: { select: { name: true } },
      classGroup: {
        select: {
          courseId: true,
          endDate: true,
          updatedAt: true,
        },
      },
    },
  });
}

function completionDate(endDate: Date | null, updatedAt: Date): Date {
  return endDate ?? updatedAt;
}

async function buildSnapshot(): Promise<CachedMultiCertSnapshot> {
  const rows = await fetchCertifiedEnrollmentRows();
  const aggregated = aggregateCertifiedStudents(
    rows.map((r) => ({
      studentId: r.studentId,
      studentName: r.student.name,
      courseId: r.classGroup.courseId,
      completedAt: completionDate(r.classGroup.endDate, r.classGroup.updatedAt),
    })),
  );
  const sorted = sortMultiCertStudents(aggregated);
  const countByStudentId: Record<string, number> = {};
  for (const s of sorted) {
    countByStudentId[s.studentId] = s.certificationCount;
  }
  return { sorted: toCachedRows(sorted), countByStudentId };
}

const getCachedSnapshot = unstable_cache(
  buildSnapshot,
  ["multi-certified-students-v2"],
  { revalidate: 300, tags: [MULTI_CERT_CACHE_TAG] },
);

async function loadSortedStudents(): Promise<AggregatedStudentCert[]> {
  const { sorted } = await getCachedSnapshot();
  return fromCachedRows(sorted);
}

function buildPayload(
  students: AggregatedStudentCert[],
  totalEligible: number,
  hiddenCount: number,
  nameMode: "public" | "full",
): MultiCertifiedShowcasePayload {
  const displayNames = assignMultiCertDisplayNames(students, nameMode);
  return {
    entries: toShowcaseEntries(students, displayNames),
    totalEligible,
    hiddenCount,
  };
}

export async function getPublicMultiCertifiedShowcase(): Promise<MultiCertifiedShowcasePayload | null> {
  const sorted = await loadSortedStudents();
  const { selected, totalEligible, hiddenCount } = selectForFeaturedShowcase(sorted);
  if (selected.length === 0) return null;
  return buildPayload(selected, totalEligible, hiddenCount, "public");
}

export async function getDashboardMultiCertifiedShowcase(): Promise<MultiCertifiedShowcasePayload | null> {
  const sorted = await loadSortedStudents();
  const { selected, totalEligible, hiddenCount } = selectForFeaturedShowcase(
    sorted,
    undefined,
    MULTI_CERT_DASHBOARD_CAP,
  );
  if (selected.length === 0) return null;
  return buildPayload(selected, totalEligible, hiddenCount, "public");
}

export async function getFullMultiCertifiedShowcase(): Promise<MultiCertifiedShowcasePayload | null> {
  const sorted = await loadSortedStudents();
  const { selected, totalEligible } = selectForFullShowcase(sorted);
  if (selected.length === 0) return null;
  return buildPayload(selected, totalEligible, 0, "public");
}

async function loadTeacherStudentIds(teacherId: string): Promise<Set<string>> {
  const rows = await prisma.enrollment.findMany({
    where: {
      student: { deletedAt: null },
      classGroup: {
        OR: [{ teacherId }, { classGroupTeachers: { some: { teacherId } } }],
      },
    },
    select: { studentId: true },
    distinct: ["studentId"],
  });
  return new Set(rows.map((r) => r.studentId));
}

/** Alunos do professor com 3+ certificações (vitrine em destaque). */
export async function getTeacherFeaturedMultiCertifiedShowcase(
  teacherId: string,
): Promise<MultiCertifiedShowcasePayload | null> {
  const [sorted, studentIds] = await Promise.all([
    loadSortedStudents(),
    loadTeacherStudentIds(teacherId),
  ]);
  const mine = sorted.filter((s) => studentIds.has(s.studentId));
  const { selected, totalEligible, hiddenCount } = selectForFeaturedShowcase(
    mine,
    undefined,
    MULTI_CERT_DASHBOARD_CAP,
  );
  if (selected.length === 0) return null;
  return buildPayload(selected, totalEligible, hiddenCount, "full");
}

export async function getStudentMultiCertProgress(
  studentId: string,
  studentName: string,
): Promise<StudentMultiCertProgress> {
  const { countByStudentId } = await getCachedSnapshot();
  const count = countByStudentId[studentId] ?? 0;
  return computeStudentMultiCertProgress(count, formatMultiCertDisplayName(studentName, "full"));
}
