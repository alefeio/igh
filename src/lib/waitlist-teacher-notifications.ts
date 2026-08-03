import "server-only";

import { prisma } from "@/lib/prisma";
import { createUserNotificationIfNew } from "@/lib/user-notifications";

/** Notifica todos os professores da turma que um aluno entrou via lista de espera. */
export async function notifyTeachersOfWaitlistEnrollment(enrollmentId: string): Promise<void> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      classGroupId: true,
      student: { select: { name: true } },
      classGroup: {
        select: {
          id: true,
          course: { select: { name: true } },
          teacher: { select: { userId: true } },
          classGroupTeachers: { select: { teacher: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!enrollment) return;

  const studentName = enrollment.student.name.trim() || "Aluno";
  const courseName = enrollment.classGroup.course.name.trim() || "Curso";
  const userIds = new Set<string>();
  if (enrollment.classGroup.teacher.userId) {
    userIds.add(enrollment.classGroup.teacher.userId);
  }
  for (const row of enrollment.classGroup.classGroupTeachers) {
    if (row.teacher.userId) userIds.add(row.teacher.userId);
  }
  if (userIds.size === 0) return;

  const title = "Aluno da lista de espera";
  const body = `${studentName} entrou na turma de ${courseName} pelo cadastro de reserva.`;
  const linkUrl = `/professor/turmas/${enrollment.classGroupId}`;

  for (const userId of userIds) {
    await createUserNotificationIfNew({
      userId,
      kind: "WAITLIST_ENROLLMENT",
      title,
      body,
      linkUrl,
      dedupeKey: `waitlist_enrollment:${enrollment.id}:${userId}`,
    });
  }
}
