import "server-only";

import { ensurePendingDocumentRemindersForStudent } from "@/lib/document-reminder-notifications";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { applyClassGroupAutomaticStatusUpdates } from "@/lib/class-group-auto-status";
import {
  attachForumLastMessagePreviews,
  getForumLessonsFromTaughtSessions,
  getForumLessonsWithActivityForCourses,
  getForumLessonsWithActivityGlobal,
  mergeTeacherForumGlobalAndTaught,
  getLastTaughtLessonIdForTeacher,
  putLastTaughtLessonFirstForTeacher,
  getStudentAttendedLessonsForumActivities,
  type DashboardForumLessonActivity,
} from "@/lib/dashboard-forum-activity";
import { formatExperienceAvg } from "@/lib/platform-experience-feedback";
import type { StudentRankEntry } from "@/lib/student-gamification-ranking";
import type {
  DashboardHolidayCalendarItem,
  DashboardSessionCalendarItem,
} from "@/lib/dashboard-admin-calendar";
import {
  getCachedActiveHolidaysRows,
  getCachedStudentGamificationRankingFull,
} from "@/lib/cached-dashboard-queries";
import { expandHolidayDateStringsInRange } from "@/lib/schedule";
import type { TeacherGamificationResult } from "@/lib/teacher-gamification";
import {
  computeAllTeachersGamification,
  computeTeacherGamification,
  getBrazilTodayDateOnly,
} from "@/lib/teacher-gamification";

export type { DashboardHolidayCalendarItem, DashboardSessionCalendarItem } from "@/lib/dashboard-admin-calendar";

/**
 * Top 9 fixos + linha 10: o 10º colocado, ou o próprio aluno (destacado) se estiver fora do top 9.
 * (Usado na página /minhas-turmas/evolucao.)
 */
export function buildStudentDashboardRankingTop(
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
  courseId: string;
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

/** Totais de engajamento na plataforma (painel admin/coordenador). */
export type PlatformEngagementSnapshot = {
  lessonsCompletedTotal: number;
  /** Linhas em progresso de aula (registros de acesso/conclusão por matrícula×aula). */
  lessonAccessRecordsTotal: number;
  exerciseAttemptsTotal: number;
  exerciseCorrectTotal: number;
  /** Presenças marcadas (sessões até hoje, Brasil). */
  attendancePresentTotal: number;
  forumQuestionsTotal: number;
  /** Respostas entre alunos (`EnrollmentLessonQuestionReply`) + respostas oficiais professor/equipe (`LessonQuestionTeacherReply`). */
  forumRepliesTotal: number;
};

/** Métricas agregadas dos alunos por turma (painel do professor). */
export type TeacherClassGroupEngagement = {
  classGroupId: string;
  courseId: string;
  courseName: string;
  /** Aulas publicadas no curso (soma dos módulos). */
  lessonsInCourse: number;
  /** Total de aulas marcadas como concluídas (soma entre todos os alunos da turma). */
  lessonsCompletedSum: number;
  /** Registros de progresso de aula (acesso ao conteúdo). */
  lessonAccessRecords: number;
  exerciseAttempts: number;
  exerciseCorrect: number;
  attendancePresent: number;
  forumQuestions: number;
  forumReplies: number;
  enrollmentsCount: number;
};

/** Resumo das avaliações de experiência (plataforma, aulas, professor). */
export type PlatformExperienceDashboardSummary = {
  totalCount: number;
  avgPlatform: number | null;
  avgLessons: number | null;
  avgTeacher: number | null;
};

/** Resumo de logins e navegação para o painel admin (horários em ISO UTC; formatar na UI). */
export type DashboardAccessActivitySummary = {
  recentLogins: Array<{
    id: string;
    createdAt: string;
    userName: string;
    userEmail: string;
  }>;
  recentPageVisits: Array<{
    id: string;
    path: string;
    createdAt: string;
    userName: string;
  }>;
};

/** Painel inicial admin/coordenador/master: só totais (detalhes em /admin/plataforma e /admin/calendario). */
export type DashboardDataAdmin = {
  role: "ADMIN" | "MASTER" | "COORDINATOR";
  roleLabel: string;
  stats: DashboardStats;
};

/** Engajamento, rankings, avaliações, fórum e acessos — página /admin/plataforma. */
export type AdminPlataformaPagePayload = {
  platformEngagement: PlatformEngagementSnapshot;
  teachersGamificationRanking: TeacherGamificationResult[];
  platformExperienceSummary: PlatformExperienceDashboardSummary;
  accessActivitySummary: DashboardAccessActivitySummary;
  forumLessonsWithActivity: DashboardForumLessonActivity[];
  studentRankingTop: StudentRankEntry[];
};

/** Painel inicial do professor: contagens e tabela de turmas (detalhes em páginas dedicadas). */
export type DashboardDataTeacher = {
  role: "TEACHER";
  roleLabel: string;
  myClassGroupsCount: number;
  myEnrollmentsCount: number;
  classGroups: ClassGroupSummary[];
};

/** Gamificação, ranking dos alunos, fórum, avaliações e engajamento por turma — página /professor/acompanhamento. */
export type TeacherAcompanhamentoPagePayload = {
  gamification: TeacherGamificationResult | null;
  platformExperienceSummary: PlatformExperienceDashboardSummary;
  forumLessonsWithActivity: DashboardForumLessonActivity[];
  studentRankingTop: StudentRankEntry[];
  teacherClassGroupStats: TeacherClassGroupEngagement[];
};

export type StudentEnrollmentSummary = {
  id: string;
  courseId: string;
  courseName: string;
  teacherName: string;
  startDate: Date;
  status: string;
  location: string | null;
  lessonsTotal: number;
  lessonsCompleted: number;
  /** Aulas com registro de progresso (acesso ao conteúdo). */
  lessonsAccessedCount: number;
  /** Respostas corretas nos exercícios desta matrícula */
  exerciseCorrectAttempts: number;
  /** Total de tentativas nos exercícios desta matrícula */
  exerciseTotalAttempts: number;
  /** Sessões com presença (até hoje). */
  attendancePresentCount: number;
  /** Tópicos criados no fórum (dúvidas). */
  forumQuestionsCount: number;
  /** Respostas no fórum. */
  forumRepliesCount: number;
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
};

export type DashboardData = DashboardDataAdmin | DashboardDataTeacher | DashboardDataStudent;

export function calendarRangeBounds() {
  const now = new Date();
  const calendarRangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const calendarRangeEnd = new Date(now.getFullYear(), now.getMonth() + 7, 0);
  return { calendarRangeStart, calendarRangeEnd };
}

/**
 * Métricas do aluno (matrículas, progresso, totais) — dashboard e páginas como /minhas-turmas/evolucao.
 */
export async function loadStudentDashboardMetrics(
  studentRecordId: string,
  userId: string,
  roleLabel: string,
): Promise<DashboardDataStudent> {
  const enrollmentsRaw = await prisma.enrollment.findMany({
    where: { studentId: studentRecordId, status: "ACTIVE" },
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
    const BRAZIL_UTC_OFFSET_HOURS = 3;
    const now = new Date();
    const brazil = new Date(now.getTime() - BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000);
    return new Date(Date.UTC(brazil.getUTCFullYear(), brazil.getUTCMonth(), brazil.getUTCDate()));
  })();

  const [
    modulesWithCount,
    progressCounts,
    exerciseAnswers,
    attendanceByEnrollment,
    forumQuestionsByEnrollment,
    forumRepliesByEnrollment,
    lessonsAccessedByEnrollment,
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
    enrollmentIds.length > 0
      ? prisma.enrollmentLessonProgress.groupBy({
          by: ["enrollmentId"],
          where: { enrollmentId: { in: enrollmentIds } },
          _count: { id: true },
        })
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
  const attendanceMap = new Map(attendanceByEnrollment.map((r) => [r.enrollmentId, r._count.id]));
  const forumQMap = new Map(forumQuestionsByEnrollment.map((r) => [r.enrollmentId, r._count.id]));
  const forumRMap = new Map(forumRepliesByEnrollment.map((r) => [r.enrollmentId, r._count.id]));
  const lessonsAccessedMap = new Map(lessonsAccessedByEnrollment.map((r) => [r.enrollmentId, r._count.id]));
  const enrollments: StudentEnrollmentSummary[] = enrollmentsRaw.map((e) => {
    const courseId = e.classGroup.courseId;
    const lessonsTotal = lessonsByCourseId.get(courseId) ?? 0;
    const lessonsCompleted = completedByEnrollmentId.get(e.id) ?? 0;
    const ex = exerciseByEnrollmentId.get(e.id) ?? { correct: 0, total: 0 };
    return {
      id: e.id,
      courseId,
      courseName: e.classGroup.course.name,
      teacherName: e.classGroup.teacher.name,
      startDate: e.classGroup.startDate,
      status: e.classGroup.status,
      location: e.classGroup.location,
      lessonsTotal,
      lessonsCompleted,
      lessonsAccessedCount: lessonsAccessedMap.get(e.id) ?? 0,
      exerciseCorrectAttempts: ex.correct,
      exerciseTotalAttempts: ex.total,
      attendancePresentCount: attendanceMap.get(e.id) ?? 0,
      forumQuestionsCount: forumQMap.get(e.id) ?? 0,
      forumRepliesCount: forumRMap.get(e.id) ?? 0,
    };
  });
  const totalLessonsCompleted = enrollments.reduce((s, e) => s + e.lessonsCompleted, 0);
  const totalLessonsTotal = enrollments.reduce((s, e) => s + e.lessonsTotal, 0);
  const totalExerciseCorrect = enrollments.reduce((s, e) => s + e.exerciseCorrectAttempts, 0);
  const totalExerciseAttempts = enrollments.reduce((s, e) => s + e.exerciseTotalAttempts, 0);
  const attendancePresentCount = attendanceByEnrollment.reduce((s, r) => s + r._count.id, 0);
  const forumQuestionsCount = forumQuestionsByEnrollment.reduce((s, r) => s + r._count.id, 0);
  const forumRepliesCount = forumRepliesByEnrollment.reduce((s, r) => s + r._count.id, 0);
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

  await ensurePendingDocumentRemindersForStudent(studentRecordId, userId);

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
  };
}

export function mapHolidaysToDashboardCalendarItems(
  holidays: Array<{
    id: string;
    name: string | null;
    date: Date;
    recurring: boolean;
    eventStartTime: string | null;
    eventEndTime: string | null;
  }>,
  rangeStart: Date,
  rangeEnd: Date,
): DashboardHolidayCalendarItem[] {
  const out: DashboardHolidayCalendarItem[] = [];
  for (const h of holidays) {
    const est = String(h.eventStartTime ?? "").trim();
    const eet = String(h.eventEndTime ?? "").trim();
    const isTimed = est.length > 0 && eet.length > 0;
    const dateStrs = expandHolidayDateStringsInRange(h, rangeStart, rangeEnd);
    const label = h.name?.trim() || (isTimed ? "Evento" : "Feriado");
    for (const dateStr of dateStrs) {
      if (isTimed) {
        out.push({
          id: `${h.id}-${dateStr}-event`,
          kind: "event",
          date: dateStr,
          name: label,
          startTime: est,
          endTime: eet,
        });
      } else {
        out.push({
          id: `${h.id}-${dateStr}-holiday`,
          kind: "holiday",
          date: dateStr,
          name: label,
        });
      }
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  return out;
}

export function mapClassSessionsToCalendarItems(
  rows: Array<{
    id: string;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    lesson: { title: string | null } | null;
    classGroup: {
      id: string;
      course: { name: string };
      teacher: { name: string };
    };
  }>,
): DashboardSessionCalendarItem[] {
  return rows.map((s) => {
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
}

function foldEnrollmentMetricToClassGroup(
  enrollmentToCg: Map<string, string>,
  perEnrollment: Map<string, number>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [eid, n] of perEnrollment) {
    const cg = enrollmentToCg.get(eid);
    if (!cg) continue;
    out.set(cg, (out.get(cg) ?? 0) + n);
  }
  return out;
}

async function loadAdminDashboardHome(
  user: SessionUser,
  roleLabel: string,
): Promise<DashboardDataAdmin> {
  const [
    students,
    teachers,
    courses,
    classGroupsTotal,
    enrollmentsTotal,
    preEnrollments,
    confirmedEnrollments,
    classGroupsByStatusRows,
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

  return {
    role: user.role as "ADMIN" | "MASTER" | "COORDINATOR",
    roleLabel,
    stats: {
      students,
      teachers,
      courses,
      classGroups: classGroupsTotal,
      enrollments: enrollmentsTotal,
      preEnrollments,
      confirmedEnrollments,
      classGroupsByStatus,
    },
  };
}

async function loadTeacherDashboardHome(
  user: SessionUser,
  roleLabel: string,
): Promise<DashboardDataTeacher> {
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
  return {
    role: "TEACHER",
    roleLabel,
    myClassGroupsCount: classGroups.length,
    myEnrollmentsCount,
    classGroups: classGroups.map((cg) => ({
      id: cg.id,
      courseId: cg.courseId,
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
  };
}

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
      };
    }
    return loadStudentDashboardMetrics(student.id, user.id, roleLabel);
  }

  if (user.role === "TEACHER") {
    return loadTeacherDashboardHome(user, roleLabel);
  }

  if (user.role === "ADMIN" || user.role === "MASTER" || user.role === "COORDINATOR") {
    return loadAdminDashboardHome(user, roleLabel);
  }

  throw new Error(`Unsupported role for dashboard: ${user.role}`);
}

/** Calendário de aulas + feriados (só alunos) — página dedicada. */
export async function getStudentCalendarPagePayload(userId: string): Promise<{
  sessions: DashboardSessionCalendarItem[];
  holidays: DashboardHolidayCalendarItem[];
} | null> {
  const student = await prisma.student.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!student) return null;
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    select: { classGroupId: true },
  });
  const classGroupIds = [...new Set(enrollments.map((e) => e.classGroupId))];
  const { calendarRangeStart, calendarRangeEnd } = calendarRangeBounds();
  const [sessionsRaw, holidaysRows] = await Promise.all([
    classGroupIds.length > 0
      ? prisma.classSession.findMany({
          where: {
            classGroupId: { in: classGroupIds },
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
        })
      : Promise.resolve([]),
    getCachedActiveHolidaysRows(),
  ]);
  return {
    sessions: mapClassSessionsToCalendarItems(sessionsRaw),
    holidays: mapHolidaysToDashboardCalendarItems(holidaysRows, calendarRangeStart, calendarRangeEnd),
  };
}

/** Evolução, ranking e trilho de fórum — página /minhas-turmas/evolucao. */
export async function getStudentEvolucaoPagePayload(user: SessionUser): Promise<{
  metrics: DashboardDataStudent;
  studentRankingTop: StudentRankEntry[];
  myStudentRank: number | null;
  myStudentPoints: StudentRankEntry["points"] | null;
  forumLessonsWithActivity: DashboardForumLessonActivity[];
} | null> {
  const student = await prisma.student.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!student) return null;
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;
  const metrics = await loadStudentDashboardMetrics(student.id, user.id, roleLabel);
  const [rankingFull, forumLessonsWithActivity] = await Promise.all([
    getCachedStudentGamificationRankingFull(),
    attachForumLastMessagePreviews(await getStudentAttendedLessonsForumActivities(metrics.enrollments.map((e) => e.id), 96)),
  ]);
  const myRow = rankingFull.find((r) => r.studentId === student.id);
  return {
    metrics,
    studentRankingTop: buildStudentDashboardRankingTop(rankingFull, student.id),
    myStudentRank: myRow?.rank ?? null,
    myStudentPoints: myRow != null ? myRow.points : null,
    forumLessonsWithActivity,
  };
}

/** Calendário de aulas + feriados (professor) — página /professor/calendario. */
export async function getTeacherCalendarPagePayload(userId: string): Promise<{
  sessions: DashboardSessionCalendarItem[];
  holidays: DashboardHolidayCalendarItem[];
} | null> {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return null;
  const classGroups = await prisma.classGroup.findMany({
    where: {
      teacherId: teacher.id,
      status: { in: ["ABERTA", "EM_ANDAMENTO"] },
    },
    select: { id: true },
  });
  const teacherCgIds = classGroups.map((cg) => cg.id);
  const { calendarRangeStart, calendarRangeEnd } = calendarRangeBounds();
  const [sessionsRaw, holidaysRows] = await Promise.all([
    teacherCgIds.length > 0
      ? prisma.classSession.findMany({
          where: {
            classGroupId: { in: teacherCgIds },
            sessionDate: { gte: calendarRangeStart, lte: calendarRangeEnd },
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
        })
      : Promise.resolve([]),
    getCachedActiveHolidaysRows(),
  ]);
  return {
    sessions: mapClassSessionsToCalendarItems(sessionsRaw),
    holidays: mapHolidaysToDashboardCalendarItems(holidaysRows, calendarRangeStart, calendarRangeEnd),
  };
}

/** Gamificação, ranking, fórum, avaliações e engajamento por turma — página /professor/acompanhamento. */
export async function getTeacherAcompanhamentoPagePayload(
  user: SessionUser,
): Promise<TeacherAcompanhamentoPagePayload | null> {
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return null;

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
  const teacherCgIds = classGroups.map((cg) => cg.id);
  const teacherForumCourseIds = await prisma.classGroup
    .findMany({
      where: { teacherId: teacher.id },
      select: { courseId: true },
    })
    .then((rows) => [...new Set(rows.map((r) => r.courseId))]);

  const studentRankingFull = await getCachedStudentGamificationRankingFull();

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
      getForumLessonsWithActivityForCourses(teacherForumCourseIds),
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

  const teacherCourseIds = [...new Set(classGroups.map((cg) => cg.courseId))];
  const enrollmentRows =
    teacherCgIds.length > 0
      ? await prisma.enrollment.findMany({
          where: { classGroupId: { in: teacherCgIds }, status: "ACTIVE" },
          select: { id: true, classGroupId: true },
        })
      : [];
  const enrollmentToCg = new Map(enrollmentRows.map((e) => [e.id, e.classGroupId]));
  const teacherEnrollmentIds = enrollmentRows.map((e) => e.id);
  const todayTeacher = getBrazilTodayDateOnly();

  const [
    modulesLessonCountTeacher,
    completedProgressTeacher,
    accessProgressTeacher,
    attendanceTeacher,
    forumQTeacher,
    forumRTeacher,
    exerciseAnswersTeacher,
  ] = await Promise.all([
    teacherCourseIds.length > 0
      ? prisma.courseModule.findMany({
          where: { courseId: { in: teacherCourseIds } },
          select: { courseId: true, _count: { select: { lessons: true } } },
        })
      : Promise.resolve([]),
    teacherEnrollmentIds.length > 0
      ? prisma.enrollmentLessonProgress.groupBy({
          by: ["enrollmentId"],
          where: { enrollmentId: { in: teacherEnrollmentIds }, completed: true },
          _count: { id: true },
        })
      : Promise.resolve([]),
    teacherEnrollmentIds.length > 0
      ? prisma.enrollmentLessonProgress.groupBy({
          by: ["enrollmentId"],
          where: { enrollmentId: { in: teacherEnrollmentIds } },
          _count: { id: true },
        })
      : Promise.resolve([]),
    teacherEnrollmentIds.length > 0
      ? prisma.sessionAttendance.groupBy({
          by: ["enrollmentId"],
          where: {
            enrollmentId: { in: teacherEnrollmentIds },
            present: true,
            classSession: { sessionDate: { lte: todayTeacher } },
          },
          _count: { id: true },
        })
      : Promise.resolve([]),
    teacherEnrollmentIds.length > 0
      ? prisma.enrollmentLessonQuestion.groupBy({
          by: ["enrollmentId"],
          where: { enrollmentId: { in: teacherEnrollmentIds } },
          _count: { id: true },
        })
      : Promise.resolve([]),
    teacherEnrollmentIds.length > 0
      ? prisma.enrollmentLessonQuestionReply.groupBy({
          by: ["enrollmentId"],
          where: { enrollmentId: { in: teacherEnrollmentIds } },
          _count: { id: true },
        })
      : Promise.resolve([]),
    teacherEnrollmentIds.length > 0
      ? prisma.enrollmentLessonExerciseAnswer.findMany({
          where: { enrollmentId: { in: teacherEnrollmentIds } },
          select: { enrollmentId: true, correct: true },
        })
      : Promise.resolve([]),
  ]);

  const lessonsByCourseIdTeacher = new Map<string, number>();
  for (const m of modulesLessonCountTeacher) {
    lessonsByCourseIdTeacher.set(
      m.courseId,
      (lessonsByCourseIdTeacher.get(m.courseId) ?? 0) + m._count.lessons
    );
  }

  const completedMap = new Map(
    completedProgressTeacher.map((r) => [r.enrollmentId, r._count.id])
  );
  const accessMap = new Map(accessProgressTeacher.map((r) => [r.enrollmentId, r._count.id]));
  const attMap = new Map(attendanceTeacher.map((r) => [r.enrollmentId, r._count.id]));
  const fqMap = new Map(forumQTeacher.map((r) => [r.enrollmentId, r._count.id]));
  const frMap = new Map(forumRTeacher.map((r) => [r.enrollmentId, r._count.id]));

  const completedByCg = foldEnrollmentMetricToClassGroup(enrollmentToCg, completedMap);
  const accessByCg = foldEnrollmentMetricToClassGroup(enrollmentToCg, accessMap);
  const attByCg = foldEnrollmentMetricToClassGroup(enrollmentToCg, attMap);
  const fqByCg = foldEnrollmentMetricToClassGroup(enrollmentToCg, fqMap);
  const frByCg = foldEnrollmentMetricToClassGroup(enrollmentToCg, frMap);

  const exByCg = new Map<string, { correct: number; total: number }>();
  for (const a of exerciseAnswersTeacher) {
    const cg = enrollmentToCg.get(a.enrollmentId);
    if (!cg) continue;
    const cur = exByCg.get(cg) ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (a.correct) cur.correct += 1;
    exByCg.set(cg, cur);
  }

  const enrollmentsCountByCg = new Map<string, number>();
  for (const e of enrollmentRows) {
    enrollmentsCountByCg.set(
      e.classGroupId,
      (enrollmentsCountByCg.get(e.classGroupId) ?? 0) + 1
    );
  }

  const teacherClassGroupStats: TeacherClassGroupEngagement[] = classGroups.map((cg) => {
    const ex = exByCg.get(cg.id) ?? { correct: 0, total: 0 };
    return {
      classGroupId: cg.id,
      courseId: cg.courseId,
      courseName: cg.course.name,
      lessonsInCourse: lessonsByCourseIdTeacher.get(cg.courseId) ?? 0,
      lessonsCompletedSum: completedByCg.get(cg.id) ?? 0,
      lessonAccessRecords: accessByCg.get(cg.id) ?? 0,
      exerciseAttempts: ex.total,
      exerciseCorrect: ex.correct,
      attendancePresent: attByCg.get(cg.id) ?? 0,
      forumQuestions: fqByCg.get(cg.id) ?? 0,
      forumReplies: frByCg.get(cg.id) ?? 0,
      enrollmentsCount: enrollmentsCountByCg.get(cg.id) ?? 0,
    };
  });

  return {
    gamification,
    platformExperienceSummary,
    forumLessonsWithActivity,
    studentRankingTop,
    teacherClassGroupStats,
  };
}

/** Calendário global de sessões + feriados — página /admin/calendario. */
export async function getAdminCalendarPagePayload(): Promise<{
  sessions: DashboardSessionCalendarItem[];
  holidays: DashboardHolidayCalendarItem[];
}> {
  const now = new Date();
  const calendarRangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const calendarRangeEnd = new Date(now.getFullYear(), now.getMonth() + 7, 0);
  const [sessionsCalendarRaw, holidaysRowsAdmin] = await Promise.all([
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
    getCachedActiveHolidaysRows(),
  ]);
  return {
    sessions: mapClassSessionsToCalendarItems(sessionsCalendarRaw),
    holidays: mapHolidaysToDashboardCalendarItems(
      holidaysRowsAdmin,
      calendarRangeStart,
      calendarRangeEnd,
    ),
  };
}

/** Engajamento, rankings, avaliações, fórum e acessos — página /admin/plataforma. */
export async function getAdminPlataformaPagePayload(
  user: SessionUser,
): Promise<AdminPlataformaPagePayload | null> {
  if (user.role !== "ADMIN" && user.role !== "MASTER" && user.role !== "COORDINATOR") {
    return null;
  }

  const todayAdmin = getBrazilTodayDateOnly();

  const studentRankingFull = await getCachedStudentGamificationRankingFull();

  const [
    platformExperienceAgg,
    forumRawGlobal,
    engagementLessonsCompleted,
    engagementLessonAccessRows,
    engagementExerciseAttempts,
    engagementExerciseCorrect,
    engagementAttendancePresent,
    engagementForumQ,
    engagementForumRStudent,
    engagementForumRTeacher,
  ] = await Promise.all([
    prisma.platformExperienceFeedback.aggregate({
      _avg: { ratingPlatform: true, ratingLessons: true, ratingTeacher: true },
      _count: { id: true },
    }),
    getForumLessonsWithActivityGlobal(),
    prisma.enrollmentLessonProgress.count({ where: { completed: true } }),
    prisma.enrollmentLessonProgress.count(),
    prisma.enrollmentLessonExerciseAnswer.count(),
    prisma.enrollmentLessonExerciseAnswer.count({ where: { correct: true } }),
    prisma.sessionAttendance.count({
      where: { present: true, classSession: { sessionDate: { lte: todayAdmin } } },
    }),
    prisma.enrollmentLessonQuestion.count(),
    prisma.enrollmentLessonQuestionReply.count(),
    prisma.lessonQuestionTeacherReply.count(),
  ]);

  const forumLessonsWithActivity = await attachForumLastMessagePreviews(forumRawGlobal);

  const teachersGamificationRanking = await computeAllTeachersGamification();

  const platformExperienceSummary: PlatformExperienceDashboardSummary = {
    totalCount: platformExperienceAgg._count.id,
    avgPlatform: formatExperienceAvg(platformExperienceAgg._avg.ratingPlatform),
    avgLessons: formatExperienceAvg(platformExperienceAgg._avg.ratingLessons),
    avgTeacher: formatExperienceAvg(platformExperienceAgg._avg.ratingTeacher),
  };

  const platformEngagement: PlatformEngagementSnapshot = {
    lessonsCompletedTotal: engagementLessonsCompleted,
    lessonAccessRecordsTotal: engagementLessonAccessRows,
    exerciseAttemptsTotal: engagementExerciseAttempts,
    exerciseCorrectTotal: engagementExerciseCorrect,
    attendancePresentTotal: engagementAttendancePresent,
    forumQuestionsTotal: engagementForumQ,
    forumRepliesTotal: engagementForumRStudent + engagementForumRTeacher,
  };

  const [recentLoginsRows, recentPageVisitRows] = await Promise.all([
    prisma.userAccessLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.userPageVisit.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        path: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  const accessActivitySummary: DashboardAccessActivitySummary = {
    recentLogins: recentLoginsRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      userName: r.user.name,
      userEmail: r.user.email,
    })),
    recentPageVisits: recentPageVisitRows.map((r) => ({
      id: r.id,
      path: r.path,
      createdAt: r.createdAt.toISOString(),
      userName: r.user.name,
    })),
  };

  return {
    platformEngagement,
    teachersGamificationRanking,
    platformExperienceSummary,
    accessActivitySummary,
    forumLessonsWithActivity,
    studentRankingTop: studentRankingFull.slice(0, 7),
  };
}
