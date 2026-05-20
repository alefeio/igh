import "server-only";

import { prisma } from "@/lib/prisma";
import {
  buildAttemptQuestionSnapshots,
  canStartExamNow,
  computeAttemptExpiresAt,
  gradeAttempt,
  getValidExercisePoolForCourse,
  pickExerciseIdsForExam,
  remainingMs,
} from "@/lib/class-group-exams";

export async function finalizeAttempt(attemptId: string, status: "SUBMITTED" | "EXPIRED" | "ABANDONED") {
  const attempt = await prisma.classGroupExamAttempt.findUnique({
    where: { id: attemptId },
    include: {
      questions: true,
      answers: true,
    },
  });
  if (!attempt || attempt.status !== "IN_PROGRESS") return null;

  const { correctCount, total, scorePercent } = gradeAttempt(
    attempt.questions.map((q) => ({ id: q.id, correctOptionId: q.correctOptionId })),
    attempt.answers.map((a) => ({
      attemptQuestionId: a.attemptQuestionId,
      selectedOptionId: a.selectedOptionId,
    }))
  );

  return prisma.classGroupExamAttempt.update({
    where: { id: attemptId },
    data: {
      status,
      submittedAt: new Date(),
      correctCount,
      totalQuestions: total,
      scorePercent,
    },
  });
}

export async function ensureAttemptNotExpired(attemptId: string) {
  const attempt = await prisma.classGroupExamAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, status: true, expiresAt: true },
  });
  if (!attempt) return null;
  if (attempt.status !== "IN_PROGRESS") return attempt;
  if (remainingMs(attempt.expiresAt) <= 0) {
    return finalizeAttempt(attemptId, "EXPIRED");
  }
  return attempt;
}

export async function createExamAttempt(examId: string, enrollmentId: string) {
  const exam = await prisma.classGroupExam.findUnique({
    where: { id: examId },
    include: { classGroup: { select: { courseId: true } } },
  });
  if (!exam) throw new Error("NOT_FOUND");

  const startCheck = canStartExamNow(exam);
  if (!startCheck.ok) throw new Error(startCheck.reason ?? "Indisponível");

  const priorCount = await prisma.classGroupExamAttempt.count({
    where: {
      examId,
      enrollmentId,
      status: { in: ["SUBMITTED", "EXPIRED", "ABANDONED"] },
    },
  });
  if (priorCount >= exam.maxAttempts) throw new Error("Limite de tentativas atingido.");

  const inProgress = await prisma.classGroupExamAttempt.findFirst({
    where: { examId, enrollmentId, status: "IN_PROGRESS" },
    include: {
      questions: { orderBy: { order: "asc" } },
      answers: { select: { attemptQuestionId: true, selectedOptionId: true } },
    },
  });
  if (inProgress) return inProgress;

  const pool = await getValidExercisePoolForCourse(exam.classGroup.courseId);
  const exerciseIds = pickExerciseIdsForExam(exam, pool);
  const exercises = exerciseIds.map((id) => {
    const p = pool.find((x) => x.id === id);
    if (!p) throw new Error("Questão inválida.");
    return p;
  });

  const snapshots = buildAttemptQuestionSnapshots(exercises, {
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
  });

  const startedAt = new Date();
  const expiresAt = computeAttemptExpiresAt(exam, startedAt);
  if (remainingMs(expiresAt, startedAt) <= 0) {
    throw new Error("Não há tempo restante para iniciar esta prova.");
  }

  const attemptNumber = priorCount + 1;

  const attempt = await prisma.classGroupExamAttempt.create({
    data: {
      examId,
      enrollmentId,
      attemptNumber,
      startedAt,
      expiresAt,
      questions: {
        create: snapshots.map((s, i) => ({
          order: i,
          exerciseId: s.exerciseId,
          questionText: s.questionText,
          optionsJson: s.optionsJson,
          correctOptionId: s.correctOptionId,
        })),
      },
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  await prisma.classGroupExamAnswer.createMany({
    data: attempt.questions.map((q) => ({
      attemptId: attempt.id,
      attemptQuestionId: q.id,
    })),
  });

  return attempt;
}

export function serializeAttemptForStudent(
  attempt: {
    id: string;
    status: string;
    startedAt: Date;
    expiresAt: Date;
    submittedAt: Date | null;
    scorePercent: number | null;
    correctCount: number | null;
    totalQuestions: number | null;
    questions: { id: string; order: number; questionText: string; optionsJson: unknown }[];
    answers?: { attemptQuestionId: string; selectedOptionId: string | null }[];
  },
  exam: { title: string; instructions: string | null; showScoreAfterSubmit: boolean }
) {
  const now = new Date();
  const remainingSeconds = Math.ceil(remainingMs(attempt.expiresAt, now) / 1000);
  const finished = attempt.status !== "IN_PROGRESS";

  return {
    attemptId: attempt.id,
    status: attempt.status,
    remainingSeconds: finished ? 0 : Math.max(0, remainingSeconds),
    expiresAt: attempt.expiresAt.toISOString(),
    exam: { title: exam.title, instructions: exam.instructions },
    questions: finished
      ? []
      : attempt.questions.map((q) => ({
          id: q.id,
          order: q.order,
          questionText: q.questionText,
          options: q.optionsJson as { id: string; text: string; order: number }[],
          selectedOptionId:
            attempt.answers?.find((a) => a.attemptQuestionId === q.id)?.selectedOptionId ?? null,
        })),
    result:
      finished && exam.showScoreAfterSubmit
        ? {
            scorePercent: attempt.scorePercent,
            correctCount: attempt.correctCount,
            totalQuestions: attempt.totalQuestions,
          }
        : finished
          ? { submitted: true }
          : null,
  };
}
