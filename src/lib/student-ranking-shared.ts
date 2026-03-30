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

export type StudentRankPointsBreakdown = {
  pointsContent: number;
  pointsExercises: number;
  pointsFrequency: number;
  pointsForum: number;
  lessonsCompleted: number;
  exerciseAttempts: number;
  exerciseCorrect: number;
  attendancePresent: number;
  forumQuestions: number;
  forumReplies: number;
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
