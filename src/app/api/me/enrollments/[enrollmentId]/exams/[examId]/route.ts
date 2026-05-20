import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { canStartExamNow } from "@/lib/class-group-exams";
import { serializeAttemptForStudent, ensureAttemptNotExpired } from "@/lib/class-group-exam-attempt";
import { requireStudentEnrollment } from "@/lib/teacher-class-group-access";

type RouteCtx = { params: Promise<{ enrollmentId: string; examId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { enrollmentId, examId } = await ctx.params;
  const access = await requireStudentEnrollment(enrollmentId);
  if ("error" in access) return access.error;

  const exam = await prisma.classGroupExam.findFirst({
    where: { id: examId, classGroupId: access.enrollment.classGroupId },
  });
  if (!exam) return jsonErr("NOT_FOUND", "Prova não encontrada.", 404);

  let attempt = await prisma.classGroupExamAttempt.findFirst({
    where: { examId, enrollmentId },
    orderBy: { attemptNumber: "desc" },
    include: {
      questions: { orderBy: { order: "asc" } },
      answers: { select: { attemptQuestionId: true, selectedOptionId: true } },
    },
  });

  if (attempt?.status === "IN_PROGRESS") {
    const checked = await ensureAttemptNotExpired(attempt.id);
    if (checked && "status" in checked && checked.status !== "IN_PROGRESS") {
      attempt = await prisma.classGroupExamAttempt.findUnique({
        where: { id: attempt.id },
        include: {
          questions: { orderBy: { order: "asc" } },
          answers: { select: { attemptQuestionId: true, selectedOptionId: true } },
        },
      });
    }
  }

  const startCheck = canStartExamNow(exam);

  return jsonOk({
    exam: {
      id: exam.id,
      title: exam.title,
      instructions: exam.instructions,
      status: exam.status,
      durationMinutes: exam.durationMinutes,
      timingMode: exam.timingMode,
      availableFrom: exam.availableFrom.toISOString(),
      availableUntil: exam.availableUntil.toISOString(),
      canStart: startCheck.ok && exam.status === "PUBLISHED",
      startBlockedReason: startCheck.ok ? null : startCheck.reason,
    },
    attempt: attempt
      ? serializeAttemptForStudent(attempt, exam)
      : null,
  });
}
