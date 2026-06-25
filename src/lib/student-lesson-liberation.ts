import "server-only";

import { getEndOfTodayBrazil } from "@/lib/brazil-today";
import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import { isClassGroupEndedForStudentAccess, isEnrollmentContentBlocked } from "@/lib/student-enrollment-access";
import { prisma } from "@/lib/prisma";

/**
 * Libera sessões SCHEDULED até hoje; turmas encerradas liberam todas as sessões restantes.
 */
export async function ensureClassSessionsLiberatedForStudent(classGroupId: string, classGroupStatus: string) {
  const endOfTodayBrazil = getEndOfTodayBrazil();
  await prisma.classSession.updateMany({
    where: {
      classGroupId,
      status: "SCHEDULED",
      sessionDate: { lte: endOfTodayBrazil },
    },
    data: { status: "LIBERADA" },
  });

  if (classGroupStatus === "ENCERRADA") {
    await prisma.classSession.updateMany({
      where: { classGroupId, status: "SCHEDULED" },
      data: { status: "LIBERADA" },
    });
  }
}

/** IDs de aulas liberadas para a matrícula (turma encerrada = curso inteiro; suspensa = nenhuma). */
export async function getLiberatedLessonIdsForEnrollment(params: {
  enrollmentId: string;
  enrollmentStatus: string;
  classGroupId: string;
  classGroupStatus: string;
  classGroupEndDate: Date | null;
  courseId: string;
}): Promise<Set<string>> {
  if (isEnrollmentContentBlocked(params.enrollmentStatus)) {
    return new Set();
  }

  await ensureClassSessionsLiberatedForStudent(params.classGroupId, params.classGroupStatus);

  const courseLessonIdsInOrder = await getCourseLessonIdsInOrder(params.courseId);

  if (
    isClassGroupEndedForStudentAccess({
      status: params.classGroupStatus,
      endDate: params.classGroupEndDate,
    })
  ) {
    return new Set(courseLessonIdsInOrder);
  }

  const liberadaSessionsOrdered = await prisma.classSession.findMany({
    where: { classGroupId: params.classGroupId, status: "LIBERADA" },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
    select: { lessonId: true },
  });

  const liberadaLessonIds = new Set<string>();
  liberadaSessionsOrdered.forEach((session, index) => {
    if (session.lessonId) liberadaLessonIds.add(session.lessonId);
    else if (courseLessonIdsInOrder[index]) liberadaLessonIds.add(courseLessonIdsInOrder[index]!);
  });

  return liberadaLessonIds;
}
