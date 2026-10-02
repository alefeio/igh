import "server-only";

import { CERTIFICATE_ATTENDANCE_THRESHOLD_PERCENT } from "@/lib/certificate-attendance-threshold";
import { getEnrollmentAttendanceSummaries } from "@/lib/enrollment-attendance-summary";
import { prisma } from "@/lib/prisma";
import { markReferralCertifiedForStudentIds } from "@/lib/student-referrals";
import { revalidateMultiCertifiedStudentsCache } from "@/lib/student-multi-certification-cache";

export { CERTIFICATE_ATTENDANCE_THRESHOLD_PERCENT };

/**
 * Ativa `certificateEligible` para matrículas com presença ≥ 70% que ainda não foram
 * sobrescritas manualmente pelo professor (`certificateEligibleManual = false`).
 * Não desativa automaticamente se a presença cair.
 */
export async function syncCertificateEligibleFromAttendance(enrollmentIds: string[]): Promise<{
  enabledIds: string[];
}> {
  const uniqueIds = [...new Set(enrollmentIds.filter(Boolean))];
  if (uniqueIds.length === 0) return { enabledIds: [] };

  const summaries = await getEnrollmentAttendanceSummaries(uniqueIds);
  const candidates = uniqueIds.filter((id) => {
    const pct = summaries.get(id)?.percent;
    return pct != null && pct >= CERTIFICATE_ATTENDANCE_THRESHOLD_PERCENT;
  });
  if (candidates.length === 0) return { enabledIds: [] };

  const toEnable = await prisma.enrollment.findMany({
    where: {
      id: { in: candidates },
      certificateEligible: false,
      certificateEligibleManual: false,
    },
    select: { id: true },
  });
  if (toEnable.length === 0) return { enabledIds: [] };

  const enabledIds = toEnable.map((e) => e.id);
  await prisma.enrollment.updateMany({
    where: { id: { in: enabledIds } },
    data: { certificateEligible: true },
  });

  const students = await prisma.enrollment.findMany({
    where: { id: { in: enabledIds } },
    select: { studentId: true },
  });
  await markReferralCertifiedForStudentIds(students.map((s) => s.studentId));

  revalidateMultiCertifiedStudentsCache();

  return { enabledIds };
}
