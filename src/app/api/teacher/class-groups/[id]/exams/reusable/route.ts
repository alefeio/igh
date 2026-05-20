import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { formatClassGroupLabel } from "@/lib/class-group-exam-reuse";
import { requireTeacherClassGroup } from "@/lib/teacher-class-group-access";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { id: classGroupId } = await ctx.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const courseId = access.classGroup.courseId;
  const teacherId = access.teacher.id;

  const exams = await prisma.classGroupExam.findMany({
    where: {
      createdByTeacherId: teacherId,
      classGroup: { courseId },
      classGroupId: { not: classGroupId },
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      classGroup: {
        select: { id: true, startDate: true, startTime: true, endTime: true },
      },
    },
  });

  return jsonOk({
    items: exams.map((e) => ({
      id: e.id,
      title: e.title,
      status: e.status,
      questionCount: e.questionCount,
      durationMinutes: e.durationMinutes,
      timingMode: e.timingMode,
      selectionMode: e.selectionMode,
      classGroupId: e.classGroupId,
      classGroupLabel: formatClassGroupLabel(e.classGroup),
      instructions: e.instructions,
      manualExerciseIds: e.manualExerciseIds,
      shuffleQuestions: e.shuffleQuestions,
      shuffleOptions: e.shuffleOptions,
      maxAttempts: e.maxAttempts,
      showScoreAfterSubmit: e.showScoreAfterSubmit,
      availableFrom: e.availableFrom.toISOString(),
      availableUntil: e.availableUntil.toISOString(),
    })),
  });
}
