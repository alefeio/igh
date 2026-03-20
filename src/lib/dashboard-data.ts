import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { applyClassGroupAutomaticStatusUpdates } from "@/lib/class-group-auto-status";
import {
  getForumLessonsWithActivityForCourses,
  type DashboardForumLessonActivity,
} from "@/lib/dashboard-forum-activity";
import { formatExperienceAvg } from "@/lib/platform-experience-feedback";
import type { TeacherGamificationResult } from "@/lib/teacher-gamification";
import { computeAllTeachersGamification, computeTeacherGamification } from "@/lib/teacher-gamification";

const ROLE_LABELS: Record<string, string> = {
  MASTER: "Administrador Master",
  ADMIN: "Administrador",
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
};

/** Resumo das avaliações de experiência (plataforma, aulas, professor). */
export type PlatformExperienceDashboardSummary = {
  totalCount: number;
  avgPlatform: number | null;
  avgLessons: number | null;
  avgTeacher: number | null;
};

export type DashboardDataAdmin = {
  role: "ADMIN" | "MASTER";
  roleLabel: string;
  stats: DashboardStats;
  recentEnrollmentsCount: number;
  openClassGroups: ClassGroupSummary[];
  /** Ranking completo de gamificação (professores); a UI pode exibir só os primeiros. */
  teachersGamificationRanking: TeacherGamificationResult[];
  platformExperienceSummary: PlatformExperienceDashboardSummary;
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
  /** Aulas com fórum ativo nos cursos que leciona (≥1 tópico de qualquer pessoa) */
  forumLessonsWithActivity: DashboardForumLessonActivity[];
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
    courseName: string;
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
};

export type DashboardData = DashboardDataAdmin | DashboardDataTeacher | DashboardDataStudent;

export async function getDashboardData(user: SessionUser): Promise<DashboardData> {
  await applyClassGroupAutomaticStatusUpdates();
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

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
      forumLessonsWithActivity,
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
      courseIds.length > 0
        ? getForumLessonsWithActivityForCourses(courseIds)
        : Promise.resolve([]),
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
        lesson: { select: { title: true } },
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
              courseName,
              lastContentPageIndex: lastViewedProgress.lastContentPageIndex,
            };
          })()
        : null;

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
    const teacherCourseRows = await prisma.classGroup.findMany({
      where: { teacherId: teacher.id },
      select: { courseId: true },
    });
    const teacherCourseIds = [...new Set(teacherCourseRows.map((r) => r.courseId))];

    const [gamification, enrollmentsForFeedback, forumLessonsWithActivity] = await Promise.all([
      computeTeacherGamification(teacher.id),
      prisma.enrollment.findMany({
        where: {
          status: "ACTIVE",
          classGroup: { teacherId: teacher.id },
          student: { userId: { not: null }, deletedAt: null },
        },
        select: { student: { select: { userId: true } } },
      }),
      getForumLessonsWithActivityForCourses(teacherCourseIds),
    ]);

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
      })),
      gamification,
      platformExperienceSummary,
      forumLessonsWithActivity,
    };
  }

  // ADMIN ou MASTER
  const [
    students,
    teachers,
    courses,
    classGroupsTotal,
    enrollmentsTotal,
    preEnrollments,
    confirmedEnrollments,
    classGroupsByStatusRows,
    recentEnrollmentsCount,
    openClassGroupsRaw,
    platformExperienceAgg,
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
    prisma.enrollment.count({
      where: {
        enrolledAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.classGroup.findMany({
      where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] } },
      include: {
        course: { select: { name: true } },
        teacher: { select: { name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { startDate: "asc" },
      take: 8,
    }),
    prisma.platformExperienceFeedback.aggregate({
      _avg: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
      _count: { id: true },
    }),
  ]);

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

  const openClassGroups: ClassGroupSummary[] = openClassGroupsRaw.map((cg) => ({
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
  }));

  const teachersGamificationRanking = await computeAllTeachersGamification();

  const platformExperienceSummary: PlatformExperienceDashboardSummary = {
    totalCount: platformExperienceAgg._count.id,
    avgPlatform: formatExperienceAvg(platformExperienceAgg._avg.ratingPlatform),
    avgLessons: formatExperienceAvg(platformExperienceAgg._avg.ratingLessons),
    avgTeacher: formatExperienceAvg(platformExperienceAgg._avg.ratingTeacher),
  };

  return {
    role: user.role as "ADMIN" | "MASTER",
    roleLabel,
    stats,
    recentEnrollmentsCount,
    openClassGroups,
    teachersGamificationRanking,
    platformExperienceSummary,
  };
}
