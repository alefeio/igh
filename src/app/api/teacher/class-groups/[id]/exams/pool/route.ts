import { jsonOk } from "@/lib/http";
import { getValidExercisePoolForCourse } from "@/lib/class-group-exams";
import { requireTeacherClassGroup } from "@/lib/teacher-class-group-access";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { id: classGroupId } = await ctx.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const pool = await getValidExercisePoolForCourse(access.classGroup.courseId);
  return jsonOk({
    items: pool.map((p) => ({
      id: p.id,
      question: p.question,
      lessonId: p.lessonId,
      lessonTitle: p.lessonTitle,
      optionsCount: p.options.length,
    })),
    total: pool.length,
  });
}
