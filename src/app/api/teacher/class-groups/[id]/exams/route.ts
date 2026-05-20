import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { getValidExercisePoolForCourse, pickExerciseIdsForExam } from "@/lib/class-group-exams";
import { requireTeacherClassGroup } from "@/lib/teacher-class-group-access";
import { classGroupExamUpsertSchema } from "@/lib/validators/class-group-exam";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { id: classGroupId } = await ctx.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const exams = await prisma.classGroupExam.findMany({
    where: { classGroupId },
    orderBy: [{ availableFrom: "desc" }],
    include: { _count: { select: { attempts: true } } },
  });

  return jsonOk({
    exams: exams.map((e) => ({
      id: e.id,
      title: e.title,
      status: e.status,
      availableFrom: e.availableFrom.toISOString(),
      availableUntil: e.availableUntil.toISOString(),
      durationMinutes: e.durationMinutes,
      timingMode: e.timingMode,
      selectionMode: e.selectionMode,
      questionCount: e.questionCount,
      attemptsCount: e._count.attempts,
    })),
  });
}

export async function POST(request: Request, ctx: RouteCtx) {
  const { id: classGroupId } = await ctx.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  const parsed = classGroupExamUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const d = parsed.data;
  const pool = await getValidExercisePoolForCourse(access.classGroup.courseId);
  try {
    if (d.selectionMode === "MANUAL") {
      const manual = d.manualExerciseIds ?? [];
      if (manual.length < d.questionCount) {
        return jsonErr("VALIDATION_ERROR", "Selecione questões suficientes no modo manual.", 400);
      }
      pickExerciseIdsForExam(
        { selectionMode: "MANUAL", questionCount: d.questionCount, manualExerciseIds: manual },
        pool
      );
    } else {
      pickExerciseIdsForExam(
        { selectionMode: "RANDOM", questionCount: d.questionCount, manualExerciseIds: [] },
        pool
      );
    }
  } catch (e) {
    return jsonErr("VALIDATION_ERROR", e instanceof Error ? e.message : "Banco de questões insuficiente.", 400);
  }

  const exam = await prisma.classGroupExam.create({
    data: {
      classGroupId,
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
      status: "DRAFT",
    },
    select: { id: true },
  });

  return jsonOk({ id: exam.id }, { status: 201 });
}
