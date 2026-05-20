import "server-only";

import { prisma } from "@/lib/prisma";

export type ExamTemplateConfig = {
  title: string;
  instructions: string | null;
  durationMinutes: number;
  timingMode: "FROM_STUDENT_START" | "FROM_EXAM_START";
  selectionMode: "RANDOM" | "MANUAL";
  questionCount: number;
  manualExerciseIds: string[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  maxAttempts: number;
  showScoreAfterSubmit: boolean;
  availableFrom: Date;
  availableUntil: Date;
};

/** Prova de outra turma do mesmo curso, criada pelo professor, apta a reutilizar. */
export async function findReusableExamForTeacher(
  sourceExamId: string,
  teacherId: string,
  targetCourseId: string
) {
  const source = await prisma.classGroupExam.findUnique({
    where: { id: sourceExamId },
    include: {
      classGroup: {
        select: {
          id: true,
          courseId: true,
          startDate: true,
          startTime: true,
          endTime: true,
        },
      },
    },
  });
  if (!source) return null;
  if (source.createdByTeacherId !== teacherId) return null;
  if (source.classGroup.courseId !== targetCourseId) return null;
  return source;
}

export function examToTemplateConfig(exam: {
  title: string;
  instructions: string | null;
  durationMinutes: number;
  timingMode: "FROM_STUDENT_START" | "FROM_EXAM_START";
  selectionMode: "RANDOM" | "MANUAL";
  questionCount: number;
  manualExerciseIds: string[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  maxAttempts: number;
  showScoreAfterSubmit: boolean;
  availableFrom: Date;
  availableUntil: Date;
}): ExamTemplateConfig {
  return {
    title: exam.title,
    instructions: exam.instructions,
    durationMinutes: exam.durationMinutes,
    timingMode: exam.timingMode,
    selectionMode: exam.selectionMode,
    questionCount: exam.questionCount,
    manualExerciseIds: exam.manualExerciseIds,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    maxAttempts: exam.maxAttempts,
    showScoreAfterSubmit: exam.showScoreAfterSubmit,
    availableFrom: exam.availableFrom,
    availableUntil: exam.availableUntil,
  };
}

export function formatClassGroupLabel(cg: {
  startDate: Date;
  startTime: string;
  endTime: string;
}): string {
  const d = cg.startDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `Turma ${d} · ${cg.startTime}–${cg.endTime}`;
}
