import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

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

export type DashboardDataAdmin = {
  role: "ADMIN" | "MASTER";
  roleLabel: string;
  stats: DashboardStats;
  recentEnrollmentsCount: number;
  openClassGroups: ClassGroupSummary[];
};

export type DashboardDataTeacher = {
  role: "TEACHER";
  roleLabel: string;
  myClassGroupsCount: number;
  myEnrollmentsCount: number;
  classGroups: ClassGroupSummary[];
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
};

export type DashboardDataStudent = {
  role: "STUDENT";
  roleLabel: string;
  activeEnrollmentsCount: number;
  enrollments: StudentEnrollmentSummary[];
};

export type DashboardData = DashboardDataAdmin | DashboardDataTeacher | DashboardDataStudent;

export async function getDashboardData(user: SessionUser): Promise<DashboardData> {
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
    const [modulesWithCount, progressCounts] = await Promise.all([
      prisma.courseModule.findMany({
        where: { courseId: { in: courseIds } },
        select: { courseId: true, _count: { select: { lessons: true } } },
      }),
      prisma.enrollmentLessonProgress.groupBy({
        by: ["enrollmentId"],
        where: { enrollmentId: { in: enrollmentIds }, completed: true },
        _count: { id: true },
      }),
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
    const enrollments: StudentEnrollmentSummary[] = enrollmentsRaw.map((e) => {
      const courseId = e.classGroup.courseId;
      const lessonsTotal = lessonsByCourseId.get(courseId) ?? 0;
      const lessonsCompleted = completedByEnrollmentId.get(e.id) ?? 0;
      return {
        id: e.id,
        courseName: e.classGroup.course.name,
        teacherName: e.classGroup.teacher.name,
        startDate: e.classGroup.startDate,
        status: e.classGroup.status,
        location: e.classGroup.location,
        lessonsTotal,
        lessonsCompleted,
      };
    });
    return {
      role: "STUDENT",
      roleLabel,
      activeEnrollmentsCount: enrollments.length,
      enrollments,
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
  ]);

  const classGroupsByStatus: Record<string, number> = {
    PLANEJADA: 0,
    ABERTA: 0,
    EM_ANDAMENTO: 0,
    ENCERRADA: 0,
    CANCELADA: 0,
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

  return {
    role: user.role as "ADMIN" | "MASTER",
    roleLabel,
    stats,
    recentEnrollmentsCount,
    openClassGroups,
  };
}
