import "server-only";

import { prisma } from "@/lib/prisma";
import {
  aggregateFirstExerciseAnswers,
  countFirstForumParticipations,
} from "@/lib/gamification-scoring-rules";
import {
  STUDENT_POINTS_PER_LESSON,
  STUDENT_RANKING_BONUS_POINTS,
  STUDENT_RANKING_GAMIFICATION_POINTS,
  type StudentRankPointsBreakdown,
  type StudentRankEntry,
} from "@/lib/student-ranking-shared";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";

export {
  STUDENT_POINTS_PER_LESSON,
  type StudentRankPointsBreakdown,
  type StudentRankEntry,
} from "@/lib/student-ranking-shared";

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

type ComputeOpts = {
  /** Após ordenar, manter só os N primeiros (default: todos). */
  limit?: number;
  /** Nomes abreviados para o site institucional. */
  nameMode?: "public" | "full";
  /** Se definido, só entram matrículas ativas em turmas deste professor (ex.: ranking no painel do professor). */
  teacherId?: string;
  /** Escopo por ciclo letivo (turmas com classGroup.cycleId). */
  cycleId?: string;
};

/**
 * Ranking de alunos com matrícula ativa, mesma pontuação exibida no dashboard do aluno.
 */
export async function computeStudentGamificationRanking(opts?: ComputeOpts): Promise<StudentRankEntry[]> {
  const limit = opts?.limit;
  const nameMode = opts?.nameMode ?? "full";
  const teacherId = opts?.teacherId;
  const cycleId = opts?.cycleId;

  const today = getBrazilTodayDateOnly();

  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "ACTIVE",
      student: { deletedAt: null },
      ...(teacherId != null || cycleId != null
        ? {
            classGroup: {
              ...(teacherId != null ? { teacherId } : {}),
              ...(cycleId != null ? { cycleId } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      studentId: true,
      student: { select: { id: true, name: true, userId: true } },
      classGroup: { select: { courseId: true } },
    },
  });

  if (enrollments.length === 0) return [];

  const enrollmentIds = enrollments.map((e) => e.id);
  const studentIdToUserId = new Map<string, string>();
  for (const e of enrollments) {
    if (e.student.userId) studentIdToUserId.set(e.studentId, e.student.userId);
  }
  const userIds = Array.from(new Set(Array.from(studentIdToUserId.values())));

  const [
    progressCounts,
    exerciseAnswers,
    attendanceByEnrollmentRows,
    forumQRows,
    forumRRows,
    platformExperienceUsers,
    mothersDayUsers,
  ] = await Promise.all([
    prisma.enrollmentLessonProgress.groupBy({
      by: ["enrollmentId"],
      where: { enrollmentId: { in: enrollmentIds }, completed: true },
      _count: { id: true },
    }),
    enrollmentIds.length > 0
      ? prisma.enrollmentLessonExerciseAnswer.findMany({
          where: { enrollmentId: { in: enrollmentIds } },
          select: { enrollmentId: true, exerciseId: true, correct: true, createdAt: true },
          orderBy: { createdAt: "asc" },
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
      ? prisma.enrollmentLessonQuestion.findMany({
          where: { enrollmentId: { in: enrollmentIds } },
          select: { enrollmentId: true, lessonId: true, createdAt: true },
        })
      : Promise.resolve([]),
    enrollmentIds.length > 0
      ? prisma.enrollmentLessonQuestionReply.findMany({
          where: { enrollmentId: { in: enrollmentIds } },
          select: {
            enrollmentId: true,
            createdAt: true,
            question: { select: { lessonId: true } },
          },
        })
      : Promise.resolve([]),
    userIds.length > 0
      ? prisma.platformExperienceFeedback.findMany({
          where: { userId: { in: userIds } },
          distinct: ["userId"],
          select: { userId: true },
        })
      : Promise.resolve([]),
    userIds.length > 0
      ? (async () => {
          const campaign = await prisma.marketingCampaign.findUnique({
            where: { slug: "dia-das-maes-2026" },
            select: { id: true },
          });
          if (!campaign) return [];
          return prisma.marketingCampaignResponse.findMany({
            where: { campaignId: campaign.id, userId: { in: userIds } },
            distinct: ["userId"],
            select: { userId: true },
          });
        })()
      : Promise.resolve([]),
  ]);

  const completedByEnrollment = new Map(progressCounts.map((p) => [p.enrollmentId, p._count.id]));
  const { byEnrollment: exerciseByEnrollment } = aggregateFirstExerciseAnswers(exerciseAnswers);
  const attByEnrollment = new Map(attendanceByEnrollmentRows.map((r) => [r.enrollmentId, r._count.id]));
  const forumScored = countFirstForumParticipations(
    forumQRows,
    forumRRows.map((r) => ({
      enrollmentId: r.enrollmentId,
      lessonId: r.question.lessonId,
      createdAt: r.createdAt,
    })),
  );
  const forumParticipationsByEnrollment = forumScored.byEnrollment;
  const hasPlatformExperienceByUserId = new Set(platformExperienceUsers.map((r) => r.userId));
  const hasMothersDayByUserId = new Set(mothersDayUsers.map((r) => r.userId));

  type Agg = {
    name: string;
    userId: string | null;
    lessonsCompleted: number;
    exerciseAttempts: number;
    exerciseCorrect: number;
    attendancePresent: number;
    forumParticipations: number;
  };
  const byStudent = new Map<string, Agg>();

  for (const e of enrollments) {
    const sid = e.studentId;
    const name = e.student.name;
    const userId = e.student.userId ?? null;
    const cur =
      byStudent.get(sid) ??
      ({
        name,
        userId,
        lessonsCompleted: 0,
        exerciseAttempts: 0,
        exerciseCorrect: 0,
        attendancePresent: 0,
        forumParticipations: 0,
      } satisfies Agg);
    cur.name = name;
    cur.userId = userId;
    cur.lessonsCompleted += completedByEnrollment.get(e.id) ?? 0;
    const ex = exerciseByEnrollment.get(e.id) ?? { attempts: 0, correct: 0 };
    cur.exerciseAttempts += ex.attempts;
    cur.exerciseCorrect += ex.correct;
    cur.attendancePresent += attByEnrollment.get(e.id) ?? 0;
    cur.forumParticipations += forumParticipationsByEnrollment.get(e.id) ?? 0;
    byStudent.set(sid, cur);
  }

  const rows: Omit<StudentRankEntry, "rank">[] = [];
  for (const [studentId, a] of byStudent) {
    const hasPlatformExperienceFeedback =
      a.userId != null ? hasPlatformExperienceByUserId.has(a.userId) : false;
    const hasMothersDayTribute = a.userId != null ? hasMothersDayByUserId.has(a.userId) : false;

    const pointsContent = a.lessonsCompleted * STUDENT_POINTS_PER_LESSON;
    const pointsExercises = a.exerciseAttempts + a.exerciseCorrect;
    const pointsFrequency =
      a.attendancePresent * STUDENT_RANKING_GAMIFICATION_POINTS.attendancePerPresentStudent;
    const pointsForum =
      a.forumParticipations * STUDENT_RANKING_GAMIFICATION_POINTS.forumPerReply;
    const pointsPlatformExperience = hasPlatformExperienceFeedback
      ? STUDENT_RANKING_BONUS_POINTS.platformExperienceFeedback
      : 0;
    const pointsMothersDay = hasMothersDayTribute ? STUDENT_RANKING_BONUS_POINTS.mothersDayTribute : 0;
    const points =
      pointsContent + pointsExercises + pointsFrequency + pointsForum + pointsPlatformExperience + pointsMothersDay;
    const breakdown: StudentRankPointsBreakdown = {
      pointsContent,
      pointsExercises,
      pointsFrequency,
      pointsForum,
      pointsPlatformExperience,
      pointsMothersDay,
      lessonsCompleted: a.lessonsCompleted,
      exerciseAttempts: a.exerciseAttempts,
      exerciseCorrect: a.exerciseCorrect,
      attendancePresent: a.attendancePresent,
      // Só 1ª participação por fórum; `forumReplies` zera para não contar 2× na UI.
      forumQuestions: a.forumParticipations,
      forumReplies: 0,
      hasPlatformExperienceFeedback,
      hasMothersDayTribute,
    };
    rows.push({
      studentId,
      displayName: formatStudentRankingDisplayName(a.name, nameMode),
      points,
      levelName: studentLevelNameFromPoints(points),
      breakdown,
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

/** Pontuação e nível do aluno (mesma fórmula do ranking), para notificações de gamificação. */
export async function getGamificationSnapshotForStudent(
  studentId: string,
  opts?: { cycleId?: string }
): Promise<{
  userId: string;
  points: number;
  levelName: string;
} | null> {
  const student = await prisma.student.findFirst({
    where: { id: studentId, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!student?.userId) return null;
  const userId = student.userId;

  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId,
      status: "ACTIVE",
      ...(opts?.cycleId ? { classGroup: { cycleId: opts.cycleId } } : {}),
    },
    select: { id: true },
  });
  if (enrollments.length === 0) {
    return {
      userId: student.userId,
      points: 0,
      levelName: studentLevelNameFromPoints(0),
    };
  }

  const enrollmentIds = enrollments.map((e) => e.id);
  const today = getBrazilTodayDateOnly();

  const [progressCounts, exerciseAnswers, attendanceByEnrollmentRows, forumQRows, forumRRows] =
    await Promise.all([
      prisma.enrollmentLessonProgress.groupBy({
        by: ["enrollmentId"],
        where: { enrollmentId: { in: enrollmentIds }, completed: true },
        _count: { id: true },
      }),
      prisma.enrollmentLessonExerciseAnswer.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        select: { enrollmentId: true, exerciseId: true, correct: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.sessionAttendance.groupBy({
        by: ["enrollmentId"],
        where: {
          enrollmentId: { in: enrollmentIds },
          present: true,
          classSession: { sessionDate: { lte: today } },
        },
        _count: { id: true },
      }),
      prisma.enrollmentLessonQuestion.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        select: { enrollmentId: true, lessonId: true, createdAt: true },
      }),
      prisma.enrollmentLessonQuestionReply.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        select: {
          enrollmentId: true,
          createdAt: true,
          question: { select: { lessonId: true } },
        },
      }),
    ]);

  let lessonsCompleted = 0;
  for (const p of progressCounts) {
    lessonsCompleted += p._count.id;
  }
  const { totalAttempts: exerciseAttempts, totalCorrect: exerciseCorrect } =
    aggregateFirstExerciseAnswers(exerciseAnswers);
  let attendancePresent = 0;
  for (const r of attendanceByEnrollmentRows) {
    attendancePresent += r._count.id;
  }
  const forumParticipations = countFirstForumParticipations(
    forumQRows,
    forumRRows.map((r) => ({
      enrollmentId: r.enrollmentId,
      lessonId: r.question.lessonId,
      createdAt: r.createdAt,
    })),
  ).total;

  const pointsContent = lessonsCompleted * STUDENT_POINTS_PER_LESSON;
  const pointsExercises = exerciseAttempts + exerciseCorrect;
  const pointsFrequency =
    attendancePresent * STUDENT_RANKING_GAMIFICATION_POINTS.attendancePerPresentStudent;
  const pointsForum = forumParticipations * STUDENT_RANKING_GAMIFICATION_POINTS.forumPerReply;
  const [hasPlatformExperienceFeedback, hasMothersDayTribute] = await Promise.all([
    prisma.platformExperienceFeedback
      .findFirst({ where: { userId }, select: { id: true } })
      .then((r) => !!r)
      .catch(() => false),
    (async () => {
      const campaign = await prisma.marketingCampaign.findUnique({
        where: { slug: "dia-das-maes-2026" },
        select: { id: true },
      });
      if (!campaign) return false;
      const row = await prisma.marketingCampaignResponse.findFirst({
        where: { campaignId: campaign.id, userId },
        select: { id: true },
      });
      return !!row;
    })().catch(() => false),
  ]);
  const pointsPlatformExperience = hasPlatformExperienceFeedback
    ? STUDENT_RANKING_BONUS_POINTS.platformExperienceFeedback
    : 0;
  const pointsMothersDay = hasMothersDayTribute ? STUDENT_RANKING_BONUS_POINTS.mothersDayTribute : 0;
  const points = pointsContent + pointsExercises + pointsFrequency + pointsForum + pointsPlatformExperience + pointsMothersDay;

  return {
    userId,
    points,
    levelName: studentLevelNameFromPoints(points),
  };
}
