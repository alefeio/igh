import "server-only";

import { prisma } from "@/lib/prisma";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";
import type { StudentBadgeContext } from "@/lib/student-badge-definitions";

/** Monta o mesmo contexto de conquistas usado no /dashboard (para notificações). */
export async function buildStudentBadgeContextFromStudentId(
  studentId: string
): Promise<StudentBadgeContext | null> {
  const enrollmentsRaw = await prisma.enrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    orderBy: { enrolledAt: "desc" },
    include: {
      classGroup: {
        select: { courseId: true },
      },
    },
  });
  if (enrollmentsRaw.length === 0) return null;

  const enrollmentIds = enrollmentsRaw.map((e) => e.id);
  const courseIds = [...new Set(enrollmentsRaw.map((e) => e.classGroup.courseId))];
  const today = getBrazilTodayDateOnly();

  const [
    modulesWithCount,
    progressCounts,
    exerciseAnswers,
    attendancePresentCount,
    forumQuestionsCount,
    forumRepliesCount,
  ] = await Promise.all([
    prisma.courseModule.findMany({
      where: { courseId: { in: courseIds } },
      select: { courseId: true, _count: { select: { lessons: true } } },
    }),
    prisma.enrollmentLessonProgress.groupBy({
      by: ["enrollmentId"],
      where: { enrollmentId: { in: enrollmentIds }, completed: true },
      _count: { id: true },
    }),
    enrollmentIds.length > 0
      ? prisma.enrollmentLessonExerciseAnswer.findMany({
          where: { enrollmentId: { in: enrollmentIds } },
          select: { enrollmentId: true, correct: true },
        })
      : Promise.resolve([]),
    enrollmentIds.length > 0
      ? prisma.sessionAttendance.count({
          where: {
            enrollmentId: { in: enrollmentIds },
            present: true,
            classSession: { sessionDate: { lte: today } },
          },
        })
      : Promise.resolve(0),
    enrollmentIds.length > 0
      ? prisma.enrollmentLessonQuestion.count({
          where: { enrollmentId: { in: enrollmentIds } },
        })
      : Promise.resolve(0),
    enrollmentIds.length > 0
      ? prisma.enrollmentLessonQuestionReply.count({
          where: { enrollmentId: { in: enrollmentIds } },
        })
      : Promise.resolve(0),
  ]);

  const lessonsByCourseId = new Map<string, number>();
  for (const m of modulesWithCount) {
    lessonsByCourseId.set(m.courseId, (lessonsByCourseId.get(m.courseId) ?? 0) + m._count.lessons);
  }
  const completedByEnrollmentId = new Map(progressCounts.map((p) => [p.enrollmentId, p._count.id]));
  const exerciseByEnrollmentId = new Map<string, { correct: number; total: number }>();
  for (const a of exerciseAnswers) {
    const cur = exerciseByEnrollmentId.get(a.enrollmentId) ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (a.correct) cur.correct += 1;
    exerciseByEnrollmentId.set(a.enrollmentId, cur);
  }

  const enrollments = enrollmentsRaw.map((e) => {
    const courseId = e.classGroup.courseId;
    const lessonsTotal = lessonsByCourseId.get(courseId) ?? 0;
    const lessonsCompleted = completedByEnrollmentId.get(e.id) ?? 0;
    const ex = exerciseByEnrollmentId.get(e.id) ?? { correct: 0, total: 0 };
    return {
      lessonsTotal,
      lessonsCompleted,
      exerciseTotalAttempts: ex.total,
    };
  });

  const totalLessonsCompleted = enrollments.reduce((s, e) => s + e.lessonsCompleted, 0);
  const totalLessonsTotal = enrollments.reduce((s, e) => s + e.lessonsTotal, 0);
  const totalExerciseAttempts = enrollments.reduce((s, e) => s + e.exerciseTotalAttempts, 0);

  return {
    total: totalLessonsTotal,
    completed: totalLessonsCompleted,
    enrollments: enrollments.map((e) => ({
      lessonsTotal: e.lessonsTotal,
      lessonsCompleted: e.lessonsCompleted,
    })),
    exerciseAttempts: totalExerciseAttempts,
    attendancePresent: attendancePresentCount,
    forumInteractions: forumQuestionsCount + forumRepliesCount,
  };
}
