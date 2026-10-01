import "server-only";

import { ENROLLMENT_HISTORY_KIND_LABEL, type EnrollmentHistoryKindValue } from "@/lib/enrollment-history";
import { prisma } from "@/lib/prisma";
import { createUserNotificationIfNew } from "@/lib/user-notifications";

function excerpt(body: string): string {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

/** Avisa professor da turma, coordenadores e diretores sobre um novo registro no histórico. */
export async function notifyEnrollmentHistoryEntry(entryId: string): Promise<void> {
  const entry = await prisma.enrollmentHistoryEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      kind: true,
      body: true,
      authorId: true,
      author: { select: { name: true } },
      enrollment: {
        select: {
          student: { select: { name: true } },
          classGroup: {
            select: {
              id: true,
              teacher: { select: { userId: true } },
              classGroupTeachers: { select: { teacher: { select: { userId: true } } } },
            },
          },
        },
      },
    },
  });
  if (!entry) return;

  const classGroup = entry.enrollment.classGroup;
  const teacherUserIds = new Set<string>();
  if (classGroup.teacher.userId) teacherUserIds.add(classGroup.teacher.userId);
  for (const link of classGroup.classGroupTeachers) {
    if (link.teacher.userId) teacherUserIds.add(link.teacher.userId);
  }

  const staff = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ role: { in: ["COORDINATOR", "DIRECTOR"] } }, { isCoordinator: true }],
    },
    select: { id: true, role: true },
  });
  const teacherUsers = teacherUserIds.size
    ? await prisma.user.findMany({
        where: { id: { in: [...teacherUserIds] }, isActive: true, role: "TEACHER" },
        select: { id: true, role: true },
      })
    : [];

  const recipients = [...teacherUsers, ...staff].filter((user) => user.id !== entry.authorId);
  if (recipients.length === 0) return;

  const studentName = entry.enrollment.student.name;
  const kindLabel =
    ENROLLMENT_HISTORY_KIND_LABEL[entry.kind as EnrollmentHistoryKindValue] ?? "Histórico";
  const title = `Histórico de ${studentName}`;
  const body = `${entry.author.name} · ${kindLabel}: ${excerpt(entry.body)}`;
  const teacherLink = `/professor/turmas/${classGroup.id}`;
  const staffLink = `/coordenacao/busca-ativa?q=${encodeURIComponent(studentName)}`;

  await Promise.all(
    recipients.map((user) =>
      createUserNotificationIfNew({
        userId: user.id,
        kind: "ENROLLMENT_HISTORY",
        title,
        body,
        linkUrl: user.role === "TEACHER" ? teacherLink : staffLink,
        dedupeKey: `enrollment-history:${entry.id}:${user.id}`,
      }),
    ),
  );
}

export async function notifyEnrollmentHistoryEntries(entryIds: string[]): Promise<void> {
  for (const entryId of entryIds) {
    try {
      await notifyEnrollmentHistoryEntry(entryId);
    } catch (error) {
      console.error("[enrollment-history] notificação", entryId, error);
    }
  }
}
