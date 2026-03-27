import "server-only";

import { prisma } from "@/lib/prisma";
import { GAMIFICATION_POINTS, getBrazilTodayDateOnly } from "@/lib/teacher-gamification";

/** Mesma regra do painel do aluno em `dashboard/page.tsx`. */
export const STUDENT_POINTS_PER_LESSON = 10;

const LEVELS = [
  { min: 0, name: "Iniciante", max: 49 },
  { min: 50, name: "Explorador", max: 149 },
  { min: 150, name: "Dedicado", max: 299 },
  { min: 300, name: "Expert", max: 499 },
  { min: 500, name: "Mestre", max: Infinity },
] as const;

export function studentLevelNameFromPoints(points: number): string {
  const level = LEVELS.find((l) => points >= l.min && points <= l.max) ?? LEVELS[0];
  return level.name;
}

/** Nome público: primeiro nome + inicial do sobrenome. */
export function formatStudentRankingDisplayName(fullName: string, mode: "public" | "full"): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Aluno";
  if (mode === "full") return parts.join(" ");
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() ?? "";
  return `${first} ${lastInitial}.`;
}

export type StudentRankEntry = {
  rank: number;
  studentId: string;
  displayName: string;
  points: number;
  levelName: string;
  /** Posição no ranking geral da plataforma (ex.: painel do professor). */
  globalRank?: number;
  /** Dashboard do aluno: última linha = você quando está fora do top 9. */
  isViewerOutOfTop9?: boolean;
};

type ComputeOpts = {
  /** Após ordenar, manter só os N primeiros (default: todos). */
  limit?: number;
  /** Nomes abreviados para o site institucional. */
  nameMode?: "public" | "full";
  /** Se definido, só entram matrículas ativas em turmas deste professor (ex.: ranking no painel do professor). */
  teacherId?: string;
};

/**
 * Ranking de alunos com matrícula ativa, mesma pontuação exibida no dashboard do aluno.
 */
export async function computeStudentGamificationRanking(opts?: ComputeOpts): Promise<StudentRankEntry[]> {
  const limit = opts?.limit;
  const nameMode = opts?.nameMode ?? "full";
  const teacherId = opts?.teacherId;

  const today = getBrazilTodayDateOnly();

  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "ACTIVE",
      student: { deletedAt: null },
      ...(teacherId != null ? { classGroup: { teacherId } } : {}),
    },
    select: {
      id: true,
      studentId: true,
      student: { select: { id: true, name: true } },
      classGroup: { select: { courseId: true } },
    },
  });

  if (enrollments.length === 0) return [];

  const enrollmentIds = enrollments.map((e) => e.id);

  const [
    progressCounts,
    exerciseAnswers,
    attendanceByEnrollmentRows,
    forumQRows,
    forumRRows,
  ] = await Promise.all([
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
      ? prisma.sessionAttendance.groupBy({
          by: ["enrollmentId"],
          where: {
            enrollmentId: { in: enrollmentIds },
            present: true,
            classSession: { sessionDate: { lte: today } },
          },
          _count: { id: true },
        })
      : Promise.resolve([]),
    enrollmentIds.length > 0
      ? prisma.enrollmentLessonQuestion.groupBy({
          by: ["enrollmentId"],
          where: { enrollmentId: { in: enrollmentIds } },
          _count: { id: true },
        })
      : Promise.resolve([]),
    enrollmentIds.length > 0
      ? prisma.enrollmentLessonQuestionReply.groupBy({
          by: ["enrollmentId"],
          where: { enrollmentId: { in: enrollmentIds } },
          _count: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const completedByEnrollment = new Map(progressCounts.map((p) => [p.enrollmentId, p._count.id]));
  const exerciseByEnrollment = new Map<string, { correct: number; total: number }>();
  for (const a of exerciseAnswers) {
    const cur = exerciseByEnrollment.get(a.enrollmentId) ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (a.correct) cur.correct += 1;
    exerciseByEnrollment.set(a.enrollmentId, cur);
  }
  const attByEnrollment = new Map(attendanceByEnrollmentRows.map((r) => [r.enrollmentId, r._count.id]));
  const forumQByEnrollment = new Map(forumQRows.map((r) => [r.enrollmentId, r._count.id]));
  const forumRByEnrollment = new Map(forumRRows.map((r) => [r.enrollmentId, r._count.id]));

  type Agg = {
    name: string;
    lessonsCompleted: number;
    exerciseAttempts: number;
    exerciseCorrect: number;
    attendancePresent: number;
    forumQuestions: number;
    forumReplies: number;
  };
  const byStudent = new Map<string, Agg>();

  for (const e of enrollments) {
    const sid = e.studentId;
    const name = e.student.name;
    const cur =
      byStudent.get(sid) ??
      ({
        name,
        lessonsCompleted: 0,
        exerciseAttempts: 0,
        exerciseCorrect: 0,
        attendancePresent: 0,
        forumQuestions: 0,
        forumReplies: 0,
      } satisfies Agg);
    cur.name = name;
    cur.lessonsCompleted += completedByEnrollment.get(e.id) ?? 0;
    const ex = exerciseByEnrollment.get(e.id) ?? { correct: 0, total: 0 };
    cur.exerciseAttempts += ex.total;
    cur.exerciseCorrect += ex.correct;
    cur.attendancePresent += attByEnrollment.get(e.id) ?? 0;
    cur.forumQuestions += forumQByEnrollment.get(e.id) ?? 0;
    cur.forumReplies += forumRByEnrollment.get(e.id) ?? 0;
    byStudent.set(sid, cur);
  }

  const rows: Omit<StudentRankEntry, "rank">[] = [];
  for (const [studentId, a] of byStudent) {
    const pointsContent = a.lessonsCompleted * STUDENT_POINTS_PER_LESSON;
    const pointsExercises = a.exerciseAttempts + a.exerciseCorrect;
    const pointsFrequency = a.attendancePresent * GAMIFICATION_POINTS.attendancePerPresentStudent;
    const pointsForum = (a.forumQuestions + a.forumReplies) * GAMIFICATION_POINTS.forumPerReply;
    const points = pointsContent + pointsExercises + pointsFrequency + pointsForum;
    rows.push({
      studentId,
      displayName: formatStudentRankingDisplayName(a.name, nameMode),
      points,
      levelName: studentLevelNameFromPoints(points),
    });
  }

  rows.sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName, "pt-BR"));

  const ranked: StudentRankEntry[] = rows.map((r, i) => ({
    ...r,
    rank: i + 1,
  }));

  if (limit != null && limit > 0) {
    return ranked.slice(0, limit);
  }
  return ranked;
}
