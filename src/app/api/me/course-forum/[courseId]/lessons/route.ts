import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";
import { getLiberadaLessonIdsForEnrollment } from "@/lib/course-forum";

/** Lista aulas do curso com contagem de tópicos no fórum (visão agregada por curso, não por turma). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { courseId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);

  const primaryEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: student.id, status: "ACTIVE", classGroup: { courseId } },
    orderBy: { enrolledAt: "asc" },
    include: {
      classGroup: {
        include: {
          sessions: {
            where: { status: "LIBERADA" },
            orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
            select: { lessonId: true, status: true },
          },
        },
      },
    },
  });
  if (!primaryEnrollment) return jsonErr("FORBIDDEN", "Você não está matriculado neste curso.", 403);

  const liberadaIds = await getLiberadaLessonIdsForEnrollment(primaryEnrollment);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { name: true },
  });
  if (!course) return jsonErr("NOT_FOUND", "Curso não encontrado.", 404);

  const modules = await getModulesWithLessonsByCourseId(courseId);
  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  if (lessonIds.length === 0) {
    return jsonOk({
      courseName: course.name,
      primaryEnrollmentId: primaryEnrollment.id,
      lessons: [] as Array<{
        lessonId: string;
        title: string;
        moduleTitle: string;
        moduleOrder: number;
        lessonOrder: number;
        topicCount: number;
        lastActivity: string | null;
        isLiberada: boolean;
      }>,
    });
  }

  const counts = await prisma.enrollmentLessonQuestion.groupBy({
    by: ["lessonId"],
    where: { lessonId: { in: lessonIds } },
    _count: { id: true },
    _max: { updatedAt: true },
  });
  const countMap = new Map(counts.map((c) => [c.lessonId, { n: c._count.id, at: c._max.updatedAt }]));

  const lessons = modules.flatMap((m) =>
    m.lessons.map((l) => {
      const c = countMap.get(l.id);
      return {
        lessonId: l.id,
        title: l.title,
        moduleTitle: m.title,
        moduleOrder: m.order,
        lessonOrder: l.order,
        topicCount: c?.n ?? 0,
        lastActivity: c?.at?.toISOString() ?? null,
        isLiberada: liberadaIds.has(l.id),
      };
    })
  );

  lessons.sort((a, b) => {
    if (a.moduleOrder !== b.moduleOrder) return a.moduleOrder - b.moduleOrder;
    return a.lessonOrder - b.lessonOrder;
  });

  return jsonOk({
    courseName: course.name,
    primaryEnrollmentId: primaryEnrollment.id,
    lessons,
  });
}
