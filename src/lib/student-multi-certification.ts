import "server-only";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { MULTI_CERT_CACHE_TAG } from "@/lib/student-multi-certification-cache";
import {
  aggregateCertifiedStudents,
  assignMultiCertDisplayNames,
  computeStudentMultiCertProgress,
  formatMultiCertDisplayName,
  selectForDashboardShowcase,
  selectForPublicShowcase,
  sortMultiCertStudents,
  toShowcaseEntries,
  type AggregatedStudentCert,
  type MultiCertifiedShowcasePayload,
  type StudentMultiCertProgress,
} from "@/lib/student-multi-certification-shared";

type CachedMultiCertSnapshot = {
  sorted: AggregatedStudentCert[];
  countByStudentId: Record<string, number>;
};

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
  return { sorted, countByStudentId };
}

const getCachedSnapshot = unstable_cache(
  buildSnapshot,
  ["multi-certified-students-v1"],
  { revalidate: 300, tags: [MULTI_CERT_CACHE_TAG] },
);

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
  try {
    const { sorted } = await getCachedSnapshot();
    const { selected, totalEligible, hiddenCount } = selectForPublicShowcase(sorted);
    if (selected.length === 0) return null;
    return buildPayload(selected, totalEligible, hiddenCount, "public");
  } catch {
    return null;
  }
}

export async function getDashboardMultiCertifiedShowcase(): Promise<MultiCertifiedShowcasePayload | null> {
  try {
    const { sorted } = await getCachedSnapshot();
    const selected = selectForDashboardShowcase(sorted);
    const totalEligible = sorted.filter((s) => s.certificationCount >= 2).length;
    if (selected.length === 0) return null;
    return buildPayload(selected, totalEligible, Math.max(0, totalEligible - selected.length), "public");
  } catch {
    return null;
  }
}

export async function getStudentMultiCertProgress(
  studentId: string,
  studentName: string,
): Promise<StudentMultiCertProgress> {
  try {
    const { countByStudentId } = await getCachedSnapshot();
    const count = countByStudentId[studentId] ?? 0;
    return computeStudentMultiCertProgress(count, formatMultiCertDisplayName(studentName, "full"));
  } catch {
    return computeStudentMultiCertProgress(0, formatMultiCertDisplayName(studentName, "full"));
  }
}
