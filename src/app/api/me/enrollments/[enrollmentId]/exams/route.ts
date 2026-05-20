import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { canStartExamNow, computeExamHardEnd } from "@/lib/class-group-exams";
import { requireStudentEnrollment } from "@/lib/teacher-class-group-access";

type RouteCtx = { params: Promise<{ enrollmentId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { enrollmentId } = await ctx.params;
  const access = await requireStudentEnrollment(enrollmentId);
  if ("error" in access) return access.error;

  const exams = await prisma.classGroupExam.findMany({
    where: {
      classGroupId: access.enrollment.classGroupId,
      status: { in: ["PUBLISHED", "CLOSED"] },
    },
    orderBy: [{ availableFrom: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      availableFrom: true,
      availableUntil: true,
      durationMinutes: true,
      timingMode: true,
      maxAttempts: true,
    },
  });

  const attempts = await prisma.classGroupExamAttempt.findMany({
    where: { enrollmentId },
    select: { examId: true, status: true, scorePercent: true, submittedAt: true },
  });
  const byExam = new Map(attempts.map((a) => [a.examId, a]));

  const now = new Date();
  return jsonOk({
    exams: exams.map((e) => {
      const att = byExam.get(e.id);
      const canStart = canStartExamNow(e);
      const hardEnd = computeExamHardEnd(e);
      return {
        id: e.id,
        title: e.title,
        status: e.status,
        availableFrom: e.availableFrom.toISOString(),
        availableUntil: e.availableUntil.toISOString(),
        durationMinutes: e.durationMinutes,
        timingMode: e.timingMode,
        hardEndAt: hardEnd.toISOString(),
        canStart: canStart.ok && e.status === "PUBLISHED",
        attemptStatus: att?.status ?? null,
        scorePercent: att?.scorePercent ?? null,
        submittedAt: att?.submittedAt?.toISOString() ?? null,
      };
    }),
    serverNow: now.toISOString(),
  });
}
