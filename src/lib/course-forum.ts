import "server-only";

import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import type { Prisma } from "@/generated/prisma/client";

type EnrollmentWithSessions = Prisma.EnrollmentGetPayload<{
  include: {
    classGroup: {
      include: {
        sessions: {
          select: { lessonId: true; status: true };
        };
      };
    };
  };
}>;

/** IDs de aulas já liberadas para a matrícula (mesma regra da API de dúvidas na aula). */
export async function getLiberadaLessonIdsForEnrollment(
  enrollment: EnrollmentWithSessions
): Promise<Set<string>> {
  const courseId = enrollment.classGroup.courseId;
  const sessions = enrollment.classGroup.sessions.filter((s) => s.status === "LIBERADA");
  const lessonIdsOrder = await getCourseLessonIdsInOrder(courseId);
  const liberadaIds = new Set<string>();
  sessions.forEach((s, i) => {
    if (s.lessonId) liberadaIds.add(s.lessonId);
    else if (lessonIdsOrder[i]) liberadaIds.add(lessonIdsOrder[i]);
  });
  return liberadaIds;
}
