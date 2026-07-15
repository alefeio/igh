/**
 * Regras de pontuação compartilhadas (aluno e professor).
 * - Fórum: só a primeira participação em cada fórum (aula) conta.
 * - Exercícios: só a primeira resposta de cada exercício conta; edições/refações não pontuam.
 */

export type ExerciseAnswerForScoring = {
  enrollmentId: string;
  exerciseId: string;
  correct: boolean;
  createdAt: Date;
};

export type ForumActivityForScoring = {
  enrollmentId: string;
  lessonId: string;
  createdAt: Date;
};

function earlier(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

/**
 * Mantém apenas a primeira resposta (por createdAt) de cada par enrollment+exercise.
 */
export function firstExerciseAnswersOnly<T extends ExerciseAnswerForScoring>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.enrollmentId}:${row.exerciseId}`;
    const prev = best.get(key);
    if (!prev || earlier(row.createdAt, prev.createdAt)) best.set(key, row);
  }
  return [...best.values()];
}

export function aggregateFirstExerciseAnswers(rows: ExerciseAnswerForScoring[]): {
  byEnrollment: Map<string, { attempts: number; correct: number }>;
  totalAttempts: number;
  totalCorrect: number;
} {
  const first = firstExerciseAnswersOnly(rows);
  const byEnrollment = new Map<string, { attempts: number; correct: number }>();
  let totalAttempts = 0;
  let totalCorrect = 0;
  for (const row of first) {
    const cur = byEnrollment.get(row.enrollmentId) ?? { attempts: 0, correct: 0 };
    cur.attempts += 1;
    totalAttempts += 1;
    if (row.correct) {
      cur.correct += 1;
      totalCorrect += 1;
    }
    byEnrollment.set(row.enrollmentId, cur);
  }
  return { byEnrollment, totalAttempts, totalCorrect };
}

/**
 * Primeira participação = mais cedo entre tópico ou resposta no mesmo (enrollment, lesson).
 * Retorna 1 unidade pontuável por fórum de aula.
 */
export function countFirstForumParticipations(
  questions: ForumActivityForScoring[],
  replies: ForumActivityForScoring[],
): {
  byEnrollment: Map<string, number>;
  total: number;
  /** Chaves `enrollmentId:lessonId` que pontuaram. */
  keys: Set<string>;
} {
  const firstAt = new Map<string, Date>();
  for (const row of [...questions, ...replies]) {
    if (!row.lessonId) continue;
    const key = `${row.enrollmentId}:${row.lessonId}`;
    const prev = firstAt.get(key);
    if (!prev || earlier(row.createdAt, prev)) firstAt.set(key, row.createdAt);
  }

  const byEnrollment = new Map<string, number>();
  for (const key of firstAt.keys()) {
    const enrollmentId = key.slice(0, key.indexOf(":"));
    byEnrollment.set(enrollmentId, (byEnrollment.get(enrollmentId) ?? 0) + 1);
  }

  return {
    byEnrollment,
    total: firstAt.size,
    keys: new Set(firstAt.keys()),
  };
}

/** Conta fóruns (lessonId) distintos em que a pessoa interagiu ao menos uma vez. */
export function countDistinctLessonForums(
  rows: Array<{ lessonId: string | null | undefined }>,
): number {
  const set = new Set<string>();
  for (const row of rows) {
    if (row.lessonId) set.add(row.lessonId);
  }
  return set.size;
}

/**
 * Primeira participação por ator+aula (ex.: professor ou staff no fórum).
 * Uma unidade pontuável por par (actorKey, lessonId).
 */
export function countFirstActorLessonParticipations(
  rows: Array<{ actorKey: string | null | undefined; lessonId: string | null | undefined }>,
): number {
  const set = new Set<string>();
  for (const row of rows) {
    if (!row.actorKey || !row.lessonId) continue;
    set.add(`${row.actorKey}:${row.lessonId}`);
  }
  return set.size;
}
