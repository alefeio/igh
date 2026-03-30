import "server-only";

import { prisma } from "@/lib/prisma";
import { createUserNotificationIfNew } from "@/lib/user-notifications";

/** Link do aluno para a seção Dúvidas da aula. */
function studentLessonForumLink(enrollmentId: string, lessonId: string) {
  return `/minhas-turmas/${enrollmentId}/conteudo/aula/${lessonId}?secao=duvidas#secoes`;
}

async function lessonTitleFromId(lessonId: string): Promise<string> {
  const l = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { title: true },
  });
  return l?.title ?? "Aula";
}

/** Nova dúvida na aula: notifica o professor da turma. */
export async function notifyTeacherOfNewForumQuestion(questionId: string): Promise<void> {
  const q = await prisma.enrollmentLessonQuestion.findUnique({
    where: { id: questionId },
    select: {
      lessonId: true,
      enrollmentId: true,
      enrollment: {
        select: {
          classGroup: {
            select: {
              courseId: true,
              teacher: { select: { userId: true, name: true } },
              course: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  const teacherUserId = q?.enrollment.classGroup.teacher.userId;
  if (!q || !teacherUserId) return;

  const courseName = q.enrollment.classGroup.course.name;
  const lessonTitle = await lessonTitleFromId(q.lessonId);
  const courseId = q.enrollment.classGroup.courseId;

  await createUserNotificationIfNew({
    userId: teacherUserId,
    kind: "FORUM_ACTIVITY",
    title: "Nova dúvida no fórum",
    body: `${courseName} — ${lessonTitle}: novo tópico na aula.`,
    linkUrl: `/professor/forum/${courseId}/aula/${q.lessonId}`,
    dedupeKey: `forum_new_q:${questionId}`,
  });
}

/** Resposta de aluno: professor + autor do tópico (se outro) + outros que participaram. */
export async function notifyParticipantsAfterStudentForumReply(
  questionId: string,
  replyId: string,
  authorEnrollmentId: string
): Promise<void> {
  const q = await prisma.enrollmentLessonQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      lessonId: true,
      enrollmentId: true,
      enrollment: {
        select: {
          student: { select: { userId: true, name: true } },
          classGroup: {
            select: {
              teacher: { select: { userId: true } },
              course: { select: { name: true } },
            },
          },
        },
      },
      replies: {
        select: {
          id: true,
          enrollmentId: true,
          enrollment: { select: { student: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!q) return;

  const courseName = q.enrollment.classGroup.course.name;
  const lessonTitle = await lessonTitleFromId(q.lessonId);
  const baseBody = `${courseName} — ${lessonTitle}: nova resposta no fórum.`;

  const teacherUserId = q.enrollment.classGroup.teacher.userId;
  if (teacherUserId) {
    await createUserNotificationIfNew({
      userId: teacherUserId,
      kind: "FORUM_ACTIVITY",
      title: "Nova resposta no fórum",
      body: baseBody,
      linkUrl: studentLessonForumLink(q.enrollmentId, q.lessonId),
      dedupeKey: `forum_st_reply:${replyId}:t`,
    });
  }

  const recipientIds = new Set<string>();

  const authorUserId = q.enrollment.student.userId;
  if (authorUserId && q.enrollmentId !== authorEnrollmentId) {
    recipientIds.add(authorUserId);
  }

  for (const r of q.replies) {
    if (r.id === replyId) continue;
    if (r.enrollmentId === authorEnrollmentId) continue;
    const uid = r.enrollment.student.userId;
    if (uid) recipientIds.add(uid);
  }

  for (const uid of recipientIds) {
    await createUserNotificationIfNew({
      userId: uid,
      kind: "FORUM_ACTIVITY",
      title: "Nova resposta no fórum",
      body: baseBody,
      linkUrl: studentLessonForumLink(q.enrollmentId, q.lessonId),
      dedupeKey: `forum_st_reply:${replyId}:${uid}`,
    });
  }
}

/** Resposta do professor ou da equipe: notifica alunos do tópico e que responderam. */
export async function notifyParticipantsAfterTeacherForumReply(
  questionId: string,
  replyId: string
): Promise<void> {
  const q = await prisma.enrollmentLessonQuestion.findUnique({
    where: { id: questionId },
    select: {
      lessonId: true,
      enrollmentId: true,
      enrollment: {
        select: {
          student: { select: { userId: true } },
          classGroup: { select: { course: { select: { name: true } } } },
        },
      },
      replies: {
        select: {
          enrollment: { select: { student: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!q) return;

  const courseName = q.enrollment.classGroup.course.name;
  const lessonTitle = await lessonTitleFromId(q.lessonId);
  const baseBody = `${courseName} — ${lessonTitle}: resposta no fórum da aula.`;

  const recipientIds = new Set<string>();
  const mainAuthor = q.enrollment.student.userId;
  if (mainAuthor) recipientIds.add(mainAuthor);
  for (const r of q.replies) {
    const uid = r.enrollment.student.userId;
    if (uid) recipientIds.add(uid);
  }

  for (const uid of recipientIds) {
    await createUserNotificationIfNew({
      userId: uid,
      kind: "FORUM_ACTIVITY",
      title: "Resposta no fórum da aula",
      body: baseBody,
      linkUrl: studentLessonForumLink(q.enrollmentId, q.lessonId),
      dedupeKey: `forum_teacher_reply:${replyId}:${uid}`,
    });
  }
}
