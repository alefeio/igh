import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { applyClassGroupAutomaticStatusUpdates } from "@/lib/class-group-auto-status";
import {
  attachForumLastMessagePreviews,
  getForumLessonsFromTaughtSessions,
  getForumLessonsWithActivityGlobal,
  mergeTeacherForumGlobalAndTaught,
  getLastTaughtLessonIdForTeacher,
  putLastTaughtLessonFirstForTeacher,
  getStudentAttendedLessonsForumActivities,
  type DashboardForumLessonActivity,
} from "@/lib/dashboard-forum-activity";
import { formatExperienceAvg } from "@/lib/platform-experience-feedback";
import type { StudentRankEntry } from "@/lib/student-gamification-ranking";
import { computeStudentGamificationRanking } from "@/lib/student-gamification-ranking";
import type { DashboardSessionCalendarItem } from "@/lib/dashboard-admin-calendar";
import type { TeacherGamificationResult } from "@/lib/teacher-gamification";
import { computeAllTeachersGamification, computeTeacherGamification } from "@/lib/teacher-gamification";

export type { DashboardSessionCalendarItem } from "@/lib/dashboard-admin-calendar";

/**
 * Top 9 fixos + linha 10: o 10º colocado, ou o próprio aluno (destacado) se estiver fora do top 9.
 */
function buildStudentDashboardRankingTop(
  full: StudentRankEntry[],
  viewerStudentId: string,
): StudentRankEntry[] {
  const myRow = full.find((r) => r.studentId === viewerStudentId);
  if (myRow == null) return full.slice(0, 10);
  if (myRow.rank <= 9) return full.slice(0, 10);
  const top9 = full.slice(0, 9);
  return [...top9, { ...myRow, isViewerOutOfTop9: true }];
}

/**
 * Os N alunos do professor com melhor colocação no ranking geral.
 * (O ranking só por turmas do professor usa pontos parciais e pode colocar na frente quem só estuda com ele,
 * em detrimento de alunos com colocação global melhor que somam pontos em outros cursos.)
 */
function buildTeacherDashboardStudentRankingTop(
  full: StudentRankEntry[],
  teacherStudentIds: ReadonlySet<string>,
  limit: number,
): StudentRankEntry[] {
  const out: StudentRankEntry[] = [];
  for (const r of full) {
    if (!teacherStudentIds.has(r.studentId)) continue;
    out.push({ ...r, globalRank: r.rank });
    if (out.length >= limit) break;
  }
  return out;
}

const ROLE_LABELS: Record<string, string> = {
  MASTER: "Administrador Master",
  ADMIN: "Administrador",
  COORDINATOR: "Coordenador",
  TEACHER: "Professor",
  STUDENT: "Aluno",
};

export type DashboardStats = {
  students: number;
  teachers: number;
  courses: number;
  classGroups: number;
  enrollments: number;
  preEnrollments: number;
  confirmedEnrollments: number;
  classGroupsByStatus: Record<string, number>;
};

export type ClassGroupSummary = {
  id: string;
  courseName: string;
  teacherName: string;
  status: string;
  startDate: Date;
  startTime: string;
  endTime: string;
  capacity: number;
  enrollmentsCount: number;
  daysOfWeek: string[];
  location: string | null;
};

/** Resumo das avaliações de experiência (plataforma, aulas, professor). */
export type PlatformExperienceDashboardSummary = {
  totalCount: number;
  avgPlatform: number | null;
  avgLessons: number | null;
  avgTeacher: number | null;
};

export type DashboardDataAdmin = {
  role: "ADMIN" | "MASTER" | "COORDINATOR";
  roleLabel: string;
  stats: DashboardStats;
  /** Ranking completo de gamificação (professores); a UI pode exibir só os primeiros. */
  teachersGamificationRanking: TeacherGamificationResult[];
  platformExperienceSummary: PlatformExperienceDashboardSummary;
  /** Fóruns com atividade em toda a plataforma (atalho para integração entre cursos). */
  forumLessonsWithActivity: DashboardForumLessonActivity[];
  /** Top alunos por pontos de gamificação (mesma regra do painel do aluno). */
  studentRankingTop: StudentRankEntry[];
  /** Sessões agendadas no período (calendário do painel). */
  sessionsCalendar: DashboardSessionCalendarItem[];
};

export type DashboardDataTeacher = {
  role: "TEACHER";
  roleLabel: string;
  myClassGroupsCount: number;
  myEnrollmentsCount: number;
  classGroups: ClassGroupSummary[];
  /** Gamificação (conteúdo, exercícios, frequência, fórum, engajamento dos alunos) */
  gamification: TeacherGamificationResult | null;
  /** Médias apenas de alunos com matrícula ativa em turmas deste professor. */
  platformExperienceSummary: PlatformExperienceDashboardSummary;
  /** Trilho de fóruns: atividade global na plataforma + aulas já ministradas nas suas turmas (com link ao fórum). */
  forumLessonsWithActivity: DashboardForumLessonActivity[];
  studentRankingTop: StudentRankEntry[];
};

export type StudentEnrollmentSummary = {
  id: string;
  courseName: string;
  teacherName: string;
  startDate: Date;
  status: string;
  location: string | null;
  lessonsTotal: number;
  lessonsCompleted: number;
  /** Respostas corretas nos exercícios desta matrícula */
  exerciseCorrectAttempts: number;
  /** Total de tentativas nos exercícios desta matrícula */
  exerciseTotalAttempts: number;
};

export type DashboardDataStudent = {
  role: "STUDENT";
  roleLabel: string;
  activeEnrollmentsCount: number;
  enrollments: StudentEnrollmentSummary[];
  /** Total de aulas concluídas em todos os cursos */
  totalLessonsCompleted: number;
  /** Total de aulas (em todos os cursos) */
  totalLessonsTotal: number;
  /** Matrícula recomendada para "continuar de onde parou" (primeira em andamento) */
  recommendedEnrollmentId: string | null;
  /** Última aula visualizada (qualquer curso), para "Continuar de onde parou" */
  lastViewedLesson: {
    enrollmentId: string;
    lessonId: string;
    lessonTitle: string;
    courseId: string;
    courseName: string;
    moduleTitle: string;
    lastContentPageIndex: number | null;
  } | null;
  /** Total de acertos em exercícios (todas as matrículas) */
  totalExerciseCorrect: number;
  /** Total de tentativas em exercícios (todas as matrículas) */
  totalExerciseAttempts: number;
  /** Total de sessões com frequência marcada como presente (present=true) */
  totalAttendancePresent: number;
  /** Total de participações no fórum: dúvidas/perguntas criadas pelo aluno */
  totalForumQuestions: number;
  /** Total de participações no fórum: respostas do aluno nas dúvidas */
  totalForumReplies: number;
  /** Aulas com fórum ativo no curso (≥1 tópico de qualquer pessoa), para atalhos no painel */
  forumLessonsWithActivity: DashboardForumLessonActivity[];
  studentRankingTop: StudentRankEntry[];
  /** Posição no ranking geral (null se sem matrícula ativa ou fora da lista). */
  myStudentRank: number | null;
  /** Pontos totais no ranking (null se não aplicável). */
  myStudentPoints: number | null;
};

export type DashboardData = DashboardDataAdmin | DashboardDataTeacher | DashboardDataStudent;

export async function getDashboardData(user: SessionUser): Promise<DashboardData> {
  await applyClassGroupAutomaticStatusUpdates();
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  const studentRankingFull = await computeStudentGamificationRanking({ nameMode: "full" });
  const studentRankingTop = studentRankingFull.slice(0, 10);

  if (user.role === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      return {
        role: "STUDENT",
        roleLabel,
        activeEnrollmentsCount: 0,
        enrollments: [],
        totalLessonsCompleted: 0,
        totalLessonsTotal: 0,
        recommendedEnrollmentId: null,
        lastViewedLesson: null,
        totalExerciseCorrect: 0,
        totalExerciseAttempts: 0,
        totalAttendancePresent: 0,
        totalForumQuestions: 0,
        totalForumReplies: 0,
        forumLessonsWithActivity: [],
        studentRankingTop,
        myStudentRank: null,
        myStudentPoints: null,
      };
    }
    const enrollmentsRaw = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: "ACTIVE" },
      orderBy: { enrolledAt: "desc" },
      include: {
        classGroup: {
          include: {
            course: { select: { id: true, name: true } },
            teacher: { select: { name: true } },
          },
        },
      },
    });
    const enrollmentIds = enrollmentsRaw.map((e) => e.id);
    const courseIds = [...new Set(enrollmentsRaw.map((e) => e.classGroup.courseId))];
    const today = (() => {
      // "Hoje" no calendário do Brasil (UTC-3), para comparar com sessionDate.
      const BRAZIL_UTC_OFFSET_HOURS = 3;
      const now = new Date();
      const brazil = new Date(now.getTime() - BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000);
      return new Date(Date.UTC(brazil.getUTCFullYear(), brazil.getUTCMonth(), brazil.getUTCDate()));
    })();

    const [
      modulesWithCount,
      progressCounts,
      exerciseAnswers,
      attendancePresentCount,
      forumQuestionsCount,
      forumRepliesCount,
    ] = await Promise.all([
      prisma.courseModule.findMany({
        where: { courseId: { in: courseIds } },
        select: { courseId: true, _count: { select: { lessons: true } } },
      }),
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
        ? prisma.sessionAttendance.count({
            where: {
              enrollmentId: { in: enrollmentIds },
              present: true,
              classSession: { sessionDate: { lte: today } },
            },
          })
        : Promise.resolve(0),
      enrollmentIds.length > 0
        ? prisma.enrollmentLessonQuestion.count({
            where: { enrollmentId: { in: enrollmentIds } },
          })
        : Promise.resolve(0),
      enrollmentIds.length > 0
        ? prisma.enrollmentLessonQuestionReply.count({
            where: { enrollmentId: { in: enrollmentIds } },
          })
        : Promise.resolve(0),
    ]);
    const lessonsByCourseId = new Map<string, number>();
    for (const m of modulesWithCount) {
      lessonsByCourseId.set(
        m.courseId,
        (lessonsByCourseId.get(m.courseId) ?? 0) + m._count.lessons
      );
    }
    const completedByEnrollmentId = new Map(
      progressCounts.map((p) => [p.enrollmentId, p._count.id])
    );
    const exerciseByEnrollmentId = new Map<string, { correct: number; total: number }>();
    for (const a of exerciseAnswers) {
      const cur = exerciseByEnrollmentId.get(a.enrollmentId) ?? { correct: 0, total: 0 };
      cur.total += 1;
      if (a.correct) cur.correct += 1;
      exerciseByEnrollmentId.set(a.enrollmentId, cur);
    }
    const enrollments: StudentEnrollmentSummary[] = enrollmentsRaw.map((e) => {
      const courseId = e.classGroup.courseId;
      const lessonsTotal = lessonsByCourseId.get(courseId) ?? 0;
      const lessonsCompleted = completedByEnrollmentId.get(e.id) ?? 0;
      const ex = exerciseByEnrollmentId.get(e.id) ?? { correct: 0, total: 0 };
      return {
        id: e.id,
        courseName: e.classGroup.course.name,
        teacherName: e.classGroup.teacher.name,
        startDate: e.classGroup.startDate,
        status: e.classGroup.status,
        location: e.classGroup.location,
        lessonsTotal,
        lessonsCompleted,
        exerciseCorrectAttempts: ex.correct,
        exerciseTotalAttempts: ex.total,
      };
    });
    const totalLessonsCompleted = enrollments.reduce((s, e) => s + e.lessonsCompleted, 0);
    const totalLessonsTotal = enrollments.reduce((s, e) => s + e.lessonsTotal, 0);
    const totalExerciseCorrect = enrollments.reduce((s, e) => s + e.exerciseCorrectAttempts, 0);
    const totalExerciseAttempts = enrollments.reduce((s, e) => s + e.exerciseTotalAttempts, 0);
    const recommended = enrollments.find(
      (e) => e.lessonsTotal > 0 && e.lessonsCompleted > 0 && e.lessonsCompleted < e.lessonsTotal
    );

    const lastViewedProgress = await prisma.enrollmentLessonProgress.findFirst({
      where: {
        enrollmentId: { in: enrollmentIds },
        lastAccessedAt: { not: null },
      },
      orderBy: { lastAccessedAt: "desc" },
      select: {
        enrollmentId: true,
        lessonId: true,
        lastContentPageIndex: true,
        lesson: {
          select: {
            title: true,
            module: { select: { title: true, courseId: true } },
          },
        },
      },
    });
    const enrollmentById = new Map(enrollmentsRaw.map((e) => [e.id, e]));
    const lastViewedLesson =
      lastViewedProgress != null
        ? (() => {
            const enrollment = enrollmentById.get(lastViewedProgress.enrollmentId);
            const courseName = enrollment?.classGroup.course.name ?? "";
            return {
              enrollmentId: lastViewedProgress.enrollmentId,
              lessonId: lastViewedProgress.lessonId,
              lessonTitle: lastViewedProgress.lesson.title,
              courseId: lastViewedProgress.lesson.module.courseId,
              courseName,
              moduleTitle: lastViewedProgress.lesson.module.title,
              lastContentPageIndex: lastViewedProgress.lastContentPageIndex,
            };
          })()
        : null;

    const forumLessonsWithActivity = await attachForumLastMessagePreviews(
      await getStudentAttendedLessonsForumActivities(enrollmentIds, 96)
    );

    const myRow = studentRankingFull.find((r) => r.studentId === student.id);
    const studentRankingTopForViewer = buildStudentDashboardRankingTop(studentRankingFull, student.id);

    return {
      role: "STUDENT",
      roleLabel,
      activeEnrollmentsCount: enrollments.length,
      enrollments,
      totalLessonsCompleted,
      totalLessonsTotal,
      recommendedEnrollmentId: recommended?.id ?? null,
      lastViewedLesson,
      totalExerciseCorrect,
      totalExerciseAttempts,
      totalAttendancePresent: attendancePresentCount,
      totalForumQuestions: forumQuestionsCount,
      totalForumReplies: forumRepliesCount,
      forumLessonsWithActivity,
      studentRankingTop: studentRankingTopForViewer,
      myStudentRank: myRow?.rank ?? null,
      myStudentPoints: myRow != null ? myRow.points : null,
    };
  }

  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      return {
        role: "TEACHER",
        roleLabel,
        myClassGroupsCount: 0,
        myEnrollmentsCount: 0,
        classGroups: [],
        gamification: null,
        platformExperienceSummary: {
          totalCount: 0,
          avgPlatform: null,
          avgLessons: null,
          avgTeacher: null,
        },
        forumLessonsWithActivity: [],
        studentRankingTop: [],
      };
    }
    const classGroups = await prisma.classGroup.findMany({
      where: {
        teacherId: teacher.id,
        status: { in: ["ABERTA", "EM_ANDAMENTO"] },
      },
      include: {
        course: { select: { name: true } },
        teacher: { select: { name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { startDate: "asc" },
    });
    const myEnrollmentsCount = await prisma.enrollment.count({
      where: {
        classGroup: { teacherId: teacher.id },
        status: "ACTIVE",
      },
    });
    const [gamification, enrollmentsForFeedback, enrollmentsForTeacherRanking, forumGlobal, forumTaught] =
      await Promise.all([
        computeTeacherGamification(teacher.id),
        prisma.enrollment.findMany({
          where: {
            status: "ACTIVE",
            classGroup: { teacherId: teacher.id },
            student: { userId: { not: null }, deletedAt: null },
          },
          select: { student: { select: { userId: true } } },
        }),
        prisma.enrollment.findMany({
          where: {
            status: "ACTIVE",
            classGroup: { teacherId: teacher.id },
            student: { deletedAt: null },
          },
          select: { studentId: true },
        }),
        getForumLessonsWithActivityGlobal(),
        getForumLessonsFromTaughtSessions(teacher.id),
      ]);

    const teacherStudentIds = new Set(enrollmentsForTeacherRanking.map((e) => e.studentId));
    const studentRankingTop = buildTeacherDashboardStudentRankingTop(
      studentRankingFull,
      teacherStudentIds,
      10,
    );
    const forumMerged = mergeTeacherForumGlobalAndTaught(forumGlobal, forumTaught);
    const lastTaughtLessonId = await getLastTaughtLessonIdForTeacher(teacher.id);
    const forumOrdered = putLastTaughtLessonFirstForTeacher(forumMerged, lastTaughtLessonId);
    const forumLessonsWithActivity = await attachForumLastMessagePreviews(forumOrdered);

    const studentUserIdsForFeedback = [
      ...new Set(
        enrollmentsForFeedback
          .map((e) => e.student.userId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];

    let platformExperienceSummary: PlatformExperienceDashboardSummary = {
      totalCount: 0,
      avgPlatform: null,
      avgLessons: null,
      avgTeacher: null,
    };
    if (studentUserIdsForFeedback.length > 0) {
      const agg = await prisma.platformExperienceFeedback.aggregate({
        where: { userId: { in: studentUserIdsForFeedback } },
        _avg: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
        _count: { id: true },
      });
      platformExperienceSummary = {
        totalCount: agg._count.id,
        avgPlatform: formatExperienceAvg(agg._avg.ratingPlatform),
        avgLessons: formatExperienceAvg(agg._avg.ratingLessons),
        avgTeacher: formatExperienceAvg(agg._avg.ratingTeacher),
      };
    }

    return {
      role: "TEACHER",
      roleLabel,
      myClassGroupsCount: classGroups.length,
      myEnrollmentsCount: myEnrollmentsCount,
      classGroups: classGroups.map((cg) => ({
        id: cg.id,
        courseName: cg.course.name,
        teacherName: cg.teacher.name,
        status: cg.status,
        startDate: cg.startDate,
        startTime: cg.startTime,
        endTime: cg.endTime,
        capacity: cg.capacity,
        enrollmentsCount: cg._count.enrollments,
        daysOfWeek: cg.daysOfWeek,
        location: cg.location ?? null,
      })),
      gamification,
      platformExperienceSummary,
      forumLessonsWithActivity,
      studentRankingTop,
    };
  }

  // ADMIN ou MASTER
  const now = new Date();
  const calendarRangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const calendarRangeEnd = new Date(now.getFullYear(), now.getMonth() + 7, 0);

  const [
    students,
    teachers,
    courses,
    classGroupsTotal,
    enrollmentsTotal,
    preEnrollments,
    confirmedEnrollments,
    classGroupsByStatusRows,
    sessionsCalendarRaw,
    platformExperienceAgg,
    forumRawGlobal,
  ] = await Promise.all([
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.teacher.count({ where: { deletedAt: null } }),
    prisma.course.count({ where: { status: "ACTIVE" } }),
    prisma.classGroup.count(),
    prisma.enrollment.count(),
    prisma.enrollment.count({ where: { isPreEnrollment: true } }),
    prisma.enrollment.count({ where: { enrollmentConfirmedAt: { not: null } } }),
    prisma.classGroup.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.classSession.findMany({
      where: {
        sessionDate: { gte: calendarRangeStart, lte: calendarRangeEnd },
        classGroup: { status: { in: ["ABERTA", "EM_ANDAMENTO"] } },
      },
      select: {
        id: true,
        sessionDate: true,
        startTime: true,
        endTime: true,
        lesson: { select: { title: true } },
        classGroup: {
          select: {
            id: true,
            course: { select: { name: true } },
            teacher: { select: { name: true } },
          },
        },
      },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
    }),
    prisma.platformExperienceFeedback.aggregate({
      _avg: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
      _count: { id: true },
    }),
    getForumLessonsWithActivityGlobal(),
  ]);

  const forumLessonsWithActivity = await attachForumLastMessagePreviews(forumRawGlobal);

  const classGroupsByStatus: Record<string, number> = {
    PLANEJADA: 0,
    ABERTA: 0,
    EM_ANDAMENTO: 0,
    ENCERRADA: 0,
    CANCELADA: 0,
    INTERNO: 0,
    EXTERNO: 0,
  };
  for (const row of classGroupsByStatusRows) {
    classGroupsByStatus[row.status] = row._count.id;
  }

  const stats: DashboardStats = {
    students,
    teachers,
    courses,
    classGroups: classGroupsTotal,
    enrollments: enrollmentsTotal,
    preEnrollments,
    confirmedEnrollments,
    classGroupsByStatus,
  };

  const sessionsCalendar: DashboardSessionCalendarItem[] = sessionsCalendarRaw.map((s) => {
    const d = s.sessionDate;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return {
      sessionId: s.id,
      sessionDate: `${y}-${m}-${day}`,
      startTime: s.startTime,
      endTime: s.endTime,
      classGroupId: s.classGroup.id,
      courseName: s.classGroup.course.name,
      teacherName: s.classGroup.teacher.name,
      lessonTitle: s.lesson?.title ?? null,
    };
  });

  const teachersGamificationRanking = await computeAllTeachersGamification();

  const platformExperienceSummary: PlatformExperienceDashboardSummary = {
    totalCount: platformExperienceAgg._count.id,
    avgPlatform: formatExperienceAvg(platformExperienceAgg._avg.ratingPlatform),
    avgLessons: formatExperienceAvg(platformExperienceAgg._avg.ratingLessons),
    avgTeacher: formatExperienceAvg(platformExperienceAgg._avg.ratingTeacher),
  };

  return {
    role: user.role as "ADMIN" | "MASTER" | "COORDINATOR",
    roleLabel,
    stats,
    teachersGamificationRanking,
    platformExperienceSummary,
    forumLessonsWithActivity,
    studentRankingTop,
    sessionsCalendar,
  };
}
