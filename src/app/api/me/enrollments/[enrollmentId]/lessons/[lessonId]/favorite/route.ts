import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Verifica se a aula está nos favoritos. Apenas STUDENT. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
    include: { classGroup: { select: { courseId: true } } },
  });
  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== enrollment.classGroup.courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  const fav = await prisma.enrollmentLessonFavorite.findUnique({
    where: {
      enrollmentId_lessonId: { enrollmentId, lessonId },
    },
  });

  return jsonOk({ favorite: !!fav });
}

/** Adiciona ou remove dos favoritos. Body: { favorite: boolean }. Apenas STUDENT. */
export async function PUT(
  request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
    include: { classGroup: { select: { courseId: true } } },
  });
  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== enrollment.classGroup.courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  let body: { favorite?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }

  const favorite = body.favorite === true;

  if (favorite) {
    await prisma.enrollmentLessonFavorite.upsert({
      where: {
        enrollmentId_lessonId: { enrollmentId, lessonId },
      },
      create: { enrollmentId, lessonId },
      update: {},
    });
  } else {
    await prisma.enrollmentLessonFavorite.deleteMany({
      where: { enrollmentId, lessonId },
    });
  }

  return jsonOk({ favorite });
}
