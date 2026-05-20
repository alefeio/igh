import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { examSubmitSchema } from "@/lib/validators/class-group-exam";
import {
  finalizeAttempt,
  ensureAttemptNotExpired,
  serializeAttemptForStudent,
} from "@/lib/class-group-exam-attempt";
import { requireStudentEnrollment } from "@/lib/teacher-class-group-access";

type RouteCtx = { params: Promise<{ enrollmentId: string; examId: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const { enrollmentId, examId } = await ctx.params;
  const access = await requireStudentEnrollment(enrollmentId);
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => ({}));
  const parsed = examSubmitSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", "Dados inválidos.", 400);

  const exam = await prisma.classGroupExam.findFirst({
    where: { id: examId, classGroupId: access.enrollment.classGroupId },
  });
  if (!exam) return jsonErr("NOT_FOUND", "Prova não encontrada.", 404);

  const attempt = await prisma.classGroupExamAttempt.findFirst({
    where: { examId, enrollmentId, status: "IN_PROGRESS" },
    include: { questions: true },
  });
  if (!attempt) return jsonErr("NOT_FOUND", "Nenhuma prova em andamento.", 404);

  await ensureAttemptNotExpired(attempt.id);

  const fresh = await prisma.classGroupExamAttempt.findUnique({
    where: { id: attempt.id },
  });
  if (!fresh || fresh.status !== "IN_PROGRESS") {
    return jsonErr("FORBIDDEN", "O tempo da prova encerrou.", 403);
  }

  if (parsed.data.answers?.length) {
    for (const a of parsed.data.answers) {
      const q = attempt.questions.find((x) => x.id === a.attemptQuestionId);
      if (!q) continue;
      await prisma.classGroupExamAnswer.update({
        where: { attemptId_attemptQuestionId: { attemptId: attempt.id, attemptQuestionId: q.id } },
        data: {
          selectedOptionId: a.optionId,
          correct: a.optionId === q.correctOptionId,
          answeredAt: new Date(),
        },
      });
    }
  }

  const finalStatus = parsed.data.abandon ? "ABANDONED" : "SUBMITTED";
  const updated = await finalizeAttempt(attempt.id, finalStatus);
  if (!updated) return jsonErr("INTERNAL_ERROR", "Falha ao encerrar.", 500);

  const full = await prisma.classGroupExamAttempt.findUnique({
    where: { id: attempt.id },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!full) return jsonErr("INTERNAL_ERROR", "Falha ao carregar resultado.", 500);

  return jsonOk({ attempt: serializeAttemptForStudent(full, exam) });
}
