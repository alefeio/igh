import "server-only";

import { prisma } from "@/lib/prisma";

export type ExamTimingMode = "FROM_STUDENT_START" | "FROM_EXAM_START";

export function isValidLessonExercise(options: { isCorrect: boolean }[]): boolean {
  if (options.length < 2) return false;
  return options.filter((o) => o.isCorrect).length === 1;
}

export function computeExamHardEnd(exam: {
  availableFrom: Date;
  availableUntil: Date;
  durationMinutes: number;
  timingMode: ExamTimingMode;
}): Date {
  const untilMs = exam.availableUntil.getTime();
  if (exam.timingMode === "FROM_EXAM_START") {
    const fixedEnd = exam.availableFrom.getTime() + exam.durationMinutes * 60_000;
    return new Date(Math.min(fixedEnd, untilMs));
  }
  return new Date(untilMs);
}

export function computeAttemptExpiresAt(
  exam: {
    availableFrom: Date;
    availableUntil: Date;
    durationMinutes: number;
    timingMode: ExamTimingMode;
  },
  startedAt: Date
): Date {
  const hardEnd = computeExamHardEnd(exam);
  if (exam.timingMode === "FROM_EXAM_START") {
    return hardEnd;
  }
  const studentEnd = startedAt.getTime() + exam.durationMinutes * 60_000;
  return new Date(Math.min(studentEnd, hardEnd.getTime()));
}

export function canStartExamNow(exam: {
  status: string;
  availableFrom: Date;
  availableUntil: Date;
  durationMinutes: number;
  timingMode: ExamTimingMode;
}): { ok: boolean; reason?: string } {
  const now = new Date();
  if (exam.status !== "PUBLISHED") {
    return { ok: false, reason: "Esta prova não está disponível." };
  }
  if (now < exam.availableFrom) {
    return { ok: false, reason: "A prova ainda não foi liberada." };
  }
  if (now > exam.availableUntil) {
    return { ok: false, reason: "O prazo para iniciar esta prova encerrou." };
  }
  const hardEnd = computeExamHardEnd(exam);
  if (exam.timingMode === "FROM_EXAM_START" && now >= hardEnd) {
    return { ok: false, reason: "O tempo da prova já encerrou." };
  }
  return { ok: true };
}

export function remainingMs(expiresAt: Date, now = new Date()): number {
  return Math.max(0, expiresAt.getTime() - now.getTime());
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function getValidExercisePoolForCourse(courseId: string): Promise<
  {
    id: string;
    question: string;
    lessonId: string;
    lessonTitle: string;
    options: { id: string; text: string; order: number; isCorrect: boolean }[];
  }[]
> {
  const lessons = await prisma.courseLesson.findMany({
    where: { module: { courseId } },
    select: {
      id: true,
      title: true,
      exercises: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          question: true,
          options: { orderBy: { order: "asc" }, select: { id: true, text: true, order: true, isCorrect: true } },
        },
      },
    },
  });

  const pool: {
    id: string;
    question: string;
    lessonId: string;
    lessonTitle: string;
    options: { id: string; text: string; order: number; isCorrect: boolean }[];
  }[] = [];

  for (const les of lessons) {
    for (const ex of les.exercises) {
      if (!isValidLessonExercise(ex.options)) continue;
      pool.push({
        id: ex.id,
        question: ex.question,
        lessonId: les.id,
        lessonTitle: les.title,
        options: ex.options,
      });
    }
  }
  return pool;
}

export function pickExerciseIdsForExam(
  exam: { selectionMode: string; questionCount: number; manualExerciseIds: string[] },
  pool: { id: string }[]
): string[] {
  if (exam.selectionMode === "MANUAL") {
    const ids = exam.manualExerciseIds.filter((id) => pool.some((p) => p.id === id));
    if (ids.length === 0) throw new Error("Nenhuma questão manual válida.");
    return ids.slice(0, exam.questionCount);
  }
  const poolIds = pool.map((p) => p.id);
  if (poolIds.length < exam.questionCount) {
    throw new Error(`Banco insuficiente: ${poolIds.length} questões válidas, precisa de ${exam.questionCount}.`);
  }
  return shuffle(poolIds).slice(0, exam.questionCount);
}

export type AttemptQuestionSnapshot = {
  exerciseId: string;
  questionText: string;
  optionsJson: { id: string; text: string; order: number }[];
  correctOptionId: string;
};

export function buildAttemptQuestionSnapshots(
  exercises: {
    id: string;
    question: string;
    options: { id: string; text: string; order: number; isCorrect: boolean }[];
  }[],
  opts: { shuffleQuestions: boolean; shuffleOptions: boolean }
): AttemptQuestionSnapshot[] {
  let ordered = [...exercises];
  if (opts.shuffleQuestions) ordered = shuffle(ordered);
  return ordered.map((ex) => {
    const correct = ex.options.find((o) => o.isCorrect);
    if (!correct) throw new Error("Exercício sem gabarito.");
    let options = ex.options.map((o) => ({ id: o.id, text: o.text, order: o.order }));
    if (opts.shuffleOptions) options = shuffle(options);
    return {
      exerciseId: ex.id,
      questionText: ex.question,
      optionsJson: options,
      correctOptionId: correct.id,
    };
  });
}

export function gradeAttempt(
  questions: { id: string; correctOptionId: string }[],
  answers: { attemptQuestionId: string; selectedOptionId: string | null }[]
): { correctCount: number; total: number; scorePercent: number } {
  const total = questions.length;
  let correctCount = 0;
  const byQ = new Map(answers.map((a) => [a.attemptQuestionId, a.selectedOptionId]));
  for (const q of questions) {
    const sel = byQ.get(q.id);
    if (sel && sel === q.correctOptionId) correctCount++;
  }
  const scorePercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  return { correctCount, total, scorePercent };
}
