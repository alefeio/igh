import "server-only";

import { prisma } from "@/lib/prisma";
import { createUserNotificationIfNew } from "@/lib/user-notifications";

/** Aulas com sessão liberada: notifica o aluno uma vez por sessão (dedupe). */
export async function ensureLessonReleasedNotifications(
  classGroupId: string,
  enrollmentId: string,
  studentUserId: string | null,
  todayUtc: Date
): Promise<void> {
  if (!studentUserId) return;

  const sessions = await prisma.classSession.findMany({
    where: {
      classGroupId,
      status: "LIBERADA",
      sessionDate: { lte: todayUtc },
      lessonId: { not: null },
    },
    select: {
      id: true,
      lessonId: true,
      lesson: { select: { title: true } },
    },
  });

  for (const s of sessions) {
    if (!s.lessonId) continue;
    await createUserNotificationIfNew({
      userId: studentUserId,
      kind: "LESSON_RELEASED",
      title: "Nova aula liberada",
      body: `A aula "${s.lesson?.title ?? "Aula"}" está disponível.`,
      linkUrl: `/minhas-turmas/${enrollmentId}/conteudo/aula/${s.lessonId}`,
      dedupeKey: `lesson_released:${enrollmentId}:${s.id}`,
    });
  }
}
