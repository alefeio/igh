import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { getValidExercisePoolForCourse, pickExerciseIdsForExam } from "@/lib/class-group-exams";
import { requireTeacherClassGroup } from "@/lib/teacher-class-group-access";
import { classGroupExamUpsertSchema } from "@/lib/validators/class-group-exam";

type RouteCtx = { params: Promise<{ id: string; examId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { id: classGroupId, examId } = await ctx.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const exam = await prisma.classGroupExam.findFirst({
    where: { id: examId, classGroupId },
    include: {
      attempts: {
        orderBy: [{ submittedAt: "desc" }],
        select: {
          id: true,
          status: true,
          startedAt: true,
          submittedAt: true,
          scorePercent: true,
          correctCount: true,
          totalQuestions: true,
          enrollment: { select: { student: { select: { name: true } } } },
        },
      },
    },
  });
  if (!exam) return jsonErr("NOT_FOUND", "Prova não encontrada.", 404);

  return jsonOk({
    exam: {
      ...exam,
      availableFrom: exam.availableFrom.toISOString(),
      availableUntil: exam.availableUntil.toISOString(),
      createdAt: exam.createdAt.toISOString(),
      updatedAt: exam.updatedAt.toISOString(),
      attempts: exam.attempts.map((a) => ({
        ...a,
        startedAt: a.startedAt.toISOString(),
        submittedAt: a.submittedAt?.toISOString() ?? null,
        studentName: a.enrollment.student.name,
      })),
    },
  });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const { id: classGroupId, examId } = await ctx.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const existing = await prisma.classGroupExam.findFirst({ where: { id: examId, classGroupId } });
  if (!existing) return jsonErr("NOT_FOUND", "Prova não encontrada.", 404);
  if (existing.status !== "DRAFT") {
    return jsonErr("FORBIDDEN", "Só é possível editar provas em rascunho.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = classGroupExamUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const d = parsed.data;
  const pool = await getValidExercisePoolForCourse(access.classGroup.courseId);
  try {
    if (d.selectionMode === "MANUAL") {
      pickExerciseIdsForExam(
        {
          selectionMode: "MANUAL",
          questionCount: d.questionCount,
          manualExerciseIds: d.manualExerciseIds ?? [],
        },
        pool
      );
    } else {
      pickExerciseIdsForExam(
        { selectionMode: "RANDOM", questionCount: d.questionCount, manualExerciseIds: [] },
        pool
      );
    }
  } catch (e) {
    return jsonErr("VALIDATION_ERROR", e instanceof Error ? e.message : "Banco insuficiente.", 400);
  }

  await prisma.classGroupExam.update({
    where: { id: examId },
    data: {
      title: d.title.trim(),
      instructions: d.instructions?.trim() || null,
      availableFrom: new Date(d.availableFrom),
      availableUntil: new Date(d.availableUntil),
      durationMinutes: d.durationMinutes,
      timingMode: d.timingMode,
      selectionMode: d.selectionMode,
      questionCount: d.questionCount,
      manualExerciseIds: d.selectionMode === "MANUAL" ? (d.manualExerciseIds ?? []) : [],
      shuffleQuestions: d.shuffleQuestions ?? true,
      shuffleOptions: d.shuffleOptions ?? true,
      maxAttempts: d.maxAttempts ?? 1,
      showScoreAfterSubmit: d.showScoreAfterSubmit ?? true,
    },
  });

  return jsonOk({ id: examId });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { id: classGroupId, examId } = await ctx.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const existing = await prisma.classGroupExam.findFirst({ where: { id: examId, classGroupId } });
  if (!existing) return jsonErr("NOT_FOUND", "Prova não encontrada.", 404);
  if (existing.status !== "DRAFT") {
    return jsonErr("FORBIDDEN", "Só é possível excluir provas em rascunho.", 403);
  }

  await prisma.classGroupExam.delete({ where: { id: examId } });
  return jsonOk({ deleted: true });
}
