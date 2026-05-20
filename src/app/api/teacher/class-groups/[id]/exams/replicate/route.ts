import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { getValidExercisePoolForCourse, pickExerciseIdsForExam } from "@/lib/class-group-exams";
import {
  examToTemplateConfig,
  findReusableExamForTeacher,
} from "@/lib/class-group-exam-reuse";
import { requireTeacherClassGroup } from "@/lib/teacher-class-group-access";
import { z } from "zod";

const replicateSchema = z.object({
  sourceExamId: z.string().uuid(),
  title: z.string().min(1).optional(),
  availableFrom: z.string().optional(),
  availableUntil: z.string().optional(),
});

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const { id: classGroupId } = await ctx.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  const parsed = replicateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const source = await findReusableExamForTeacher(
    parsed.data.sourceExamId,
    access.teacher.id,
    access.classGroup.courseId
  );
  if (!source) {
    return jsonErr("NOT_FOUND", "Prova modelo não encontrada ou não pode ser reutilizada.", 404);
  }

  const template = examToTemplateConfig(source);
  const availableFrom = parsed.data.availableFrom
    ? new Date(parsed.data.availableFrom)
    : template.availableFrom;
  const availableUntil = parsed.data.availableUntil
    ? new Date(parsed.data.availableUntil)
    : template.availableUntil;
  if (availableUntil <= availableFrom) {
    return jsonErr("VALIDATION_ERROR", "O término deve ser após o início.", 400);
  }

  const pool = await getValidExercisePoolForCourse(access.classGroup.courseId);
  try {
    if (template.selectionMode === "MANUAL") {
      pickExerciseIdsForExam(
        {
          selectionMode: "MANUAL",
          questionCount: template.questionCount,
          manualExerciseIds: template.manualExerciseIds,
        },
        pool
      );
    } else {
      pickExerciseIdsForExam(
        { selectionMode: "RANDOM", questionCount: template.questionCount, manualExerciseIds: [] },
        pool
      );
    }
  } catch (e) {
    return jsonErr("VALIDATION_ERROR", e instanceof Error ? e.message : "Banco insuficiente.", 400);
  }

  const exam = await prisma.classGroupExam.create({
    data: {
      classGroupId,
      createdByTeacherId: access.teacher.id,
      title: (parsed.data.title?.trim() || template.title).trim(),
      instructions: template.instructions,
      availableFrom,
      availableUntil,
      durationMinutes: template.durationMinutes,
      timingMode: template.timingMode,
      selectionMode: template.selectionMode,
      questionCount: template.questionCount,
      manualExerciseIds: template.manualExerciseIds,
      shuffleQuestions: template.shuffleQuestions,
      shuffleOptions: template.shuffleOptions,
      maxAttempts: template.maxAttempts,
      showScoreAfterSubmit: template.showScoreAfterSubmit,
      status: "DRAFT",
    },
    select: { id: true },
  });

  return jsonOk({ id: exam.id, replicatedFromExamId: source.id }, { status: 201 });
}
