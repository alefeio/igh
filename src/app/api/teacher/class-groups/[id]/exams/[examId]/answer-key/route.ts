import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { buildManualExamAnswerKey } from "@/lib/class-group-exam-teacher-view";
import { requireTeacherClassGroup } from "@/lib/teacher-class-group-access";

type RouteCtx = { params: Promise<{ id: string; examId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { id: classGroupId, examId } = await ctx.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const exam = await prisma.classGroupExam.findFirst({
    where: { id: examId, classGroupId },
    select: {
      selectionMode: true,
      questionCount: true,
      manualExerciseIds: true,
    },
  });
  if (!exam) return jsonErr("NOT_FOUND", "Prova não encontrada.", 404);

  if (exam.selectionMode === "MANUAL") {
    const questions = await buildManualExamAnswerKey(exam);
    return jsonOk({ mode: "MANUAL" as const, questions });
  }

  return jsonOk({
    mode: "RANDOM" as const,
    questions: [],
    note:
      "As questões são sorteadas individualmente para cada aluno. O gabarito fixo não se aplica a toda a turma — abra a prova de cada aluno em Resultados para ver questões e respostas corretas.",
  });
}
