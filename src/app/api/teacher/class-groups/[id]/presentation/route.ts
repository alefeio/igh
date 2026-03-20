import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";

export const dynamic = "force-dynamic";

/** Índice de módulos e aulas do curso da turma (modo apresentação). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId } = await context.params;

  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

  const cg = await prisma.classGroup.findFirst({
    where: { id: classGroupId, teacherId: teacher.id },
    select: {
      id: true,
      courseId: true,
      course: { select: { name: true } },
    },
  });
  if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  const modules = await getModulesWithLessonsByCourseId(cg.courseId);

  return jsonOk({
    classGroup: {
      id: cg.id,
      courseName: cg.course.name,
    },
    modules: modules.map((m) => ({
      id: m.id,
      title: m.title,
      order: m.order,
      lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, order: l.order })),
    })),
  });
}
