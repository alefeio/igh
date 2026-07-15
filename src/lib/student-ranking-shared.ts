/**
 * Tipos e constantes do ranking de alunos — seguros para importar em Client Components.
 * (Não importar `student-gamification-ranking.ts` no cliente: ele usa `server-only` e Prisma.)
 */

export const STUDENT_POINTS_PER_LESSON = 10;

/** Valores alinhados a `GAMIFICATION_POINTS` em `@/lib/teacher-gamification` (apenas o que entra na pontuação do aluno). */
export const STUDENT_RANKING_GAMIFICATION_POINTS = {
  attendancePerPresentStudent: 2,
  forumPerReply: 5,
} as const;

/** Bônus alto por ações importantes (contabiliza 1x por aluno). */
export const STUDENT_RANKING_BONUS_POINTS = {
  platformExperienceFeedback: 300,
  mothersDayTribute: 300,
} as const;

export type StudentRankPointsBreakdown = {
  pointsContent: number;
  pointsExercises: number;
  pointsFrequency: number;
  pointsForum: number;
  pointsPlatformExperience: number;
  pointsMothersDay: number;
  lessonsCompleted: number;
  /** Primeiras respostas a exercícios (refações não contam). */
  exerciseAttempts: number;
  /** Acertos apenas nas primeiras respostas. */
  exerciseCorrect: number;
  attendancePresent: number;
  /**
   * Fóruns (aulas) pontuados: só a 1ª participação por fórum.
   * `forumReplies` fica 0 na pontuação (compatibilidade da UI).
   */
  forumQuestions: number;
  forumReplies: number;
  hasPlatformExperienceFeedback: boolean;
  hasMothersDayTribute: boolean;
};

export type StudentRankEntry = {
  rank: number;
  studentId: string;
  displayName: string;
  points: number;
  levelName: string;
  breakdown: StudentRankPointsBreakdown;
  globalRank?: number;
  isViewerOutOfTop9?: boolean;
};
