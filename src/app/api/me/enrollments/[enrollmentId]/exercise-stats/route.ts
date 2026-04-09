import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
    select: {
      classGroup: {
        select: {
          course: { select: { name: true } },
        },
      },
    },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

  const cached = unstable_cache(
    async () => {
      const answers = await prisma.enrollmentLessonExerciseAnswer.findMany({
        where: { enrollmentId },
        select: {
          correct: true,
          exerciseId: true,
          exercise: {
            select: {
              lessonId: true,
              lesson: {
                select: {
                  id: true,
                  title: true,
                  module: { select: { title: true, order: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const byLesson = new Map<
        string,
        {
          lessonId: string;
          lessonTitle: string;
          moduleTitle: string;
          moduleOrder: number;
          attempts: { correct: boolean }[];
        }
      >();
      for (const a of answers) {
        if (!a.exercise?.lesson) continue;
        const lesson = a.exercise.lesson;
        const key = lesson.id;
        if (!byLesson.has(key)) {
          byLesson.set(key, {
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            moduleTitle: lesson.module.title,
            moduleOrder: lesson.module.order,
            attempts: [],
          });
        }
        byLesson.get(key)!.attempts.push({ correct: a.correct });
      }

      const lessonStats = Array.from(byLesson.values()).map((l) => {
        const total = l.attempts.length;
        const correct = l.attempts.filter((x) => x.correct).length;
        const lastCorrect = total > 0 ? l.attempts[l.attempts.length - 1].correct : null;
        return {
          lessonId: l.lessonId,
          lessonTitle: l.lessonTitle,
          moduleTitle: l.moduleTitle,
          moduleOrder: l.moduleOrder,
          totalAttempts: total,
          correctAttempts: correct,
          lastAttemptCorrect: lastCorrect,
          ratio: total > 0 ? correct / total : 0,
        };
      });

      const totalCorrect = lessonStats.reduce((s, l) => s + l.correctAttempts, 0);
      const totalAttempts = lessonStats.reduce((s, l) => s + l.totalAttempts, 0);

      const thresholdBem = 0.7;
      const thresholdAtencao = 0.5;
      const topicsBem = lessonStats.filter((s) => s.totalAttempts > 0 && s.ratio >= thresholdBem);
      const topicsAtencao = lessonStats.filter((s) => s.totalAttempts > 0 && s.ratio < thresholdAtencao);

      return {
        totalCorrect,
        totalAttempts,
        lessonStats,
        topicsBem,
        topicsAtencao,
      };
    },
    ["exercise-stats", user.id, enrollmentId],
    { revalidate: 60 }
  );

  const exerciseStats = await cached();

  return jsonOk({
    courseName: enrollment.classGroup.course.name,
    exerciseStats,
  });
}

