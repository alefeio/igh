import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  getEnrollmentAttendanceSummaries,
  type EnrollmentAttendanceSummary,
} from "@/lib/enrollment-attendance-summary";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  enrollmentIds: z.array(z.string().uuid()).max(5000),
});

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "TEACHER", "COORDINATOR"]);

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const enrollmentIds = [...new Set(parsed.data.enrollmentIds)];
  if (enrollmentIds.length === 0) {
    return jsonOk({ summaries: {} as Record<string, EnrollmentAttendanceSummary> });
  }

  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

    const allowedCount = await prisma.enrollment.count({
      where: {
        id: { in: enrollmentIds },
        classGroup: { teacherId: teacher.id },
      },
    });
    if (allowedCount !== enrollmentIds.length) {
      return jsonErr("FORBIDDEN", "Sem permissão para consultar frequência de algumas matrículas.", 403);
    }
  }

  const map = await getEnrollmentAttendanceSummaries(enrollmentIds);
  const summaries: Record<string, EnrollmentAttendanceSummary> = {};
  for (const [id, summary] of map) {
    summaries[id] = summary;
  }

  return jsonOk({ summaries });
}
