import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { examAnswerSchema } from "@/lib/validators/class-group-exam";
import { ensureAttemptNotExpired } from "@/lib/class-group-exam-attempt";
import { requireStudentEnrollment } from "@/lib/teacher-class-group-access";

type RouteCtx = { params: Promise<{ enrollmentId: string; examId: string }> };

export async function PATCH(request: Request, ctx: RouteCtx) {
  const { enrollmentId, examId } = await ctx.params;
  const access = await requireStudentEnrollment(enrollmentId);
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  const parsed = examAnswerSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", "Resposta inválida.", 400);

  const attempt = await prisma.classGroupExamAttempt.findFirst({
    where: { examId, enrollmentId, status: "IN_PROGRESS" },
    include: { questions: true },
  });
  if (!attempt) return jsonErr("NOT_FOUND", "Nenhuma prova em andamento.", 404);

  const checked = await ensureAttemptNotExpired(attempt.id);
  if (!checked || checked.status !== "IN_PROGRESS") {
    return jsonErr("FORBIDDEN", "O tempo da prova encerrou.", 403);
  }

  const q = attempt.questions.find((x) => x.id === parsed.data.attemptQuestionId);
  if (!q) return jsonErr("NOT_FOUND", "Questão não encontrada.", 404);

  const options = q.optionsJson as { id: string }[];
  if (!options.some((o) => o.id === parsed.data.optionId)) {
    return jsonErr("VALIDATION_ERROR", "Opção inválida.", 400);
  }

  await prisma.classGroupExamAnswer.update({
    where: { attemptId_attemptQuestionId: { attemptId: attempt.id, attemptQuestionId: q.id } },
    data: {
      selectedOptionId: parsed.data.optionId,
      correct: parsed.data.optionId === q.correctOptionId,
      answeredAt: new Date(),
    },
  });

  return jsonOk({ saved: true });
}
