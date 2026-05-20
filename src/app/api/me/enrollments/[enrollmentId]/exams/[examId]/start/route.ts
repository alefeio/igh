import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { createExamAttempt, serializeAttemptForStudent } from "@/lib/class-group-exam-attempt";
import { requireStudentEnrollment } from "@/lib/teacher-class-group-access";

type RouteCtx = { params: Promise<{ enrollmentId: string; examId: string }> };

export async function POST(_req: Request, ctx: RouteCtx) {
  const { enrollmentId, examId } = await ctx.params;
  const access = await requireStudentEnrollment(enrollmentId);
  if ("error" in access) return access.error;

  const exam = await prisma.classGroupExam.findFirst({
    where: { id: examId, classGroupId: access.enrollment.classGroupId, status: "PUBLISHED" },
  });
  if (!exam) return jsonErr("NOT_FOUND", "Prova não disponível.", 404);

  try {
    const attempt = await createExamAttempt(examId, enrollmentId);
    const full = await prisma.classGroupExamAttempt.findUnique({
      where: { id: attempt.id },
      include: {
        questions: { orderBy: { order: "asc" } },
        answers: { select: { attemptQuestionId: true, selectedOptionId: true } },
      },
    });
    if (!full) return jsonErr("INTERNAL_ERROR", "Falha ao iniciar.", 500);
    return jsonOk({ attempt: serializeAttemptForStudent(full, exam) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Não foi possível iniciar.";
    return jsonErr("FORBIDDEN", msg, 403);
  }
}
