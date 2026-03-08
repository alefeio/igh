import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Lista todas as aulas favoritadas do aluno (em qualquer matrícula). Apenas STUDENT. */
export async function GET() {
  const user = await requireRole("STUDENT");

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const favorites = await prisma.enrollmentLessonFavorite.findMany({
    where: {
      enrollment: { studentId: student.id, status: "ACTIVE" },
    },
    orderBy: { createdAt: "desc" },
    include: {
      enrollment: {
        select: { id: true },
      },
      lesson: {
        select: {
          id: true,
          title: true,
          module: {
            select: {
              title: true,
              course: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const list = favorites.map((f) => ({
    enrollmentId: f.enrollmentId,
    lessonId: f.lesson.id,
    courseName: f.lesson.module.course.name,
    moduleTitle: f.lesson.module.title,
    lessonTitle: f.lesson.title,
    createdAt: f.createdAt.toISOString(),
  }));

  return jsonOk({ favorites: list });
}
