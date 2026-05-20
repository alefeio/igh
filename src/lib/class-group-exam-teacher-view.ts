import "server-only";

import { prisma } from "@/lib/prisma";
import { examOptionLabel } from "@/lib/exam-option-labels";

export type ExamOptionView = {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
};

export type ExamQuestionKeyView = {
  order: number;
  questionText: string;
  lessonTitle: string | null;
  options: ExamOptionView[];
};

export async function buildManualExamAnswerKey(exam: {
  manualExerciseIds: string[];
  questionCount: number;
}): Promise<ExamQuestionKeyView[]> {
  if (exam.manualExerciseIds.length === 0) return [];

  const exercises = await prisma.courseLessonExercise.findMany({
    where: { id: { in: exam.manualExerciseIds } },
    include: {
      options: { orderBy: { order: "asc" } },
      lesson: { select: { title: true } },
    },
  });
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const out: ExamQuestionKeyView[] = [];
  let order = 0;
  for (const id of exam.manualExerciseIds.slice(0, exam.questionCount)) {
    const ex = byId.get(id);
    if (!ex) continue;
    out.push({
      order: order++,
      questionText: ex.question,
      lessonTitle: ex.lesson.title,
      options: ex.options.map((o, i) => ({
        id: o.id,
        label: examOptionLabel(i),
        text: o.text,
        isCorrect: o.isCorrect,
      })),
    });
  }
  return out;
}

export async function buildAttemptReview(attemptId: string, classGroupId: string) {
  const attempt = await prisma.classGroupExamAttempt.findFirst({
    where: { id: attemptId, exam: { classGroupId } },
    include: {
      enrollment: { select: { student: { select: { name: true } } } },
      exam: { select: { title: true, selectionMode: true } },
      questions: { orderBy: { order: "asc" } },
      answers: true,
    },
  });
  if (!attempt) return null;

  const answerByQ = new Map(attempt.answers.map((a) => [a.attemptQuestionId, a]));

  const questions = attempt.questions.map((q) => {
    const opts = (q.optionsJson as { id: string; text: string; order: number }[]).slice().sort(
      (a, b) => a.order - b.order
    );
    const ans = answerByQ.get(q.id);
    const selectedId = ans?.selectedOptionId ?? null;
    return {
      id: q.id,
      order: q.order,
      questionText: q.questionText,
      options: opts.map((o, i) => ({
        id: o.id,
        label: examOptionLabel(i),
        text: o.text,
        isCorrect: o.id === q.correctOptionId,
        isSelected: o.id === selectedId,
      })),
      answered: selectedId != null,
      correct: ans?.correct ?? false,
    };
  });

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      studentName: attempt.enrollment.student.name,
      examTitle: attempt.exam.title,
      scorePercent: attempt.scorePercent,
      correctCount: attempt.correctCount,
      totalQuestions: attempt.totalQuestions,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
    },
    questions,
  };
}
