import { prisma } from "@/lib/prisma";
import type { EmailAudienceType } from "@/generated/prisma/client";

export interface EmailAudienceRecipient {
  recipientType: "student" | "teacher" | "user";
  recipientId: string;
  name: string;
  /** E-mail usado para envio: Student.email ?? User.email, Teacher.email ?? User.email, User.email */
  email: string | null;
  classGroupName?: string | null;
  courseName?: string | null;
}

export type EmailAudienceFilters = {
  classGroupId?: string;
  courseId?: string;
  [key: string]: unknown;
};

function studentEmail(
  studentEmail: string | null,
  userEmail: string | null
): string | null {
  const raw = studentEmail ?? userEmail ?? null;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim();
}

function teacherEmail(
  teacherEmail: string | null,
  userEmail: string | null
): string | null {
  const raw = teacherEmail ?? userEmail ?? null;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim();
}

/**
 * Resolve a lista de destinatários por e-mail conforme tipo de público e filtros.
 * E-mail pode ser null (cadastro incompleto ou sem e-mail).
 */
export async function resolveEmailAudience(
  audienceType: EmailAudienceType,
  filters: EmailAudienceFilters | null
): Promise<EmailAudienceRecipient[]> {
  switch (audienceType) {
    case "ALL_STUDENTS": {
      const students = await prisma.student.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          user: { select: { email: true } },
          enrollments: {
            where: { status: "ACTIVE" },
            take: 1,
            select: {
              classGroup: {
                select: { course: { select: { name: true } } },
              },
            },
          },
        },
      });
      return students.map((s) => ({
        recipientType: "student" as const,
        recipientId: s.id,
        name: s.name,
        email: studentEmail(s.email, s.user?.email ?? null),
        classGroupName: s.enrollments[0]?.classGroup?.course?.name ?? null,
        courseName: s.enrollments[0]?.classGroup?.course?.name ?? null,
      }));
    }

    case "CLASS_GROUP": {
      const classGroupId = filters?.classGroupId;
      if (!classGroupId) return [];
      const enrollments = await prisma.enrollment.findMany({
        where: { classGroupId, status: "ACTIVE" },
        select: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              user: { select: { email: true } },
            },
          },
          classGroup: {
            select: { course: { select: { name: true } } },
          },
        },
      });
      return enrollments.map((e) => ({
        recipientType: "student" as const,
        recipientId: e.student.id,
        name: e.student.name,
        email: studentEmail(e.student.email, e.student.user?.email ?? null),
        classGroupName: e.classGroup.course.name,
        courseName: e.classGroup.course.name,
      }));
    }

    case "STUDENTS_INCOMPLETE": {
      const students = await prisma.student.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          user: { select: { email: true } },
          enrollments: {
            where: { status: "ACTIVE" },
            take: 1,
            select: {
              classGroup: {
                select: { course: { select: { name: true } } },
              },
            },
          },
        },
      });
      const withoutValidEmail = students.filter(
        (s) => !studentEmail(s.email, s.user?.email ?? null)
      );
      return withoutValidEmail.map((s) => ({
        recipientType: "student" as const,
        recipientId: s.id,
        name: s.name,
        email: null as string | null,
        classGroupName: s.enrollments[0]?.classGroup?.course?.name ?? null,
        courseName: s.enrollments[0]?.classGroup?.course?.name ?? null,
      }));
    }

    case "STUDENTS_COMPLETE": {
      const students = await prisma.student.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          user: { select: { email: true } },
          enrollments: {
            where: { status: "ACTIVE" },
            take: 1,
            select: {
              classGroup: {
                select: { course: { select: { name: true } } },
              },
            },
          },
        },
      });
      const withEmail = students.filter((s) =>
        studentEmail(s.email, s.user?.email ?? null)
      );
      return withEmail.map((s) => ({
        recipientType: "student" as const,
        recipientId: s.id,
        name: s.name,
        email: studentEmail(s.email, s.user?.email ?? null)!,
        classGroupName: s.enrollments[0]?.classGroup?.course?.name ?? null,
        courseName: s.enrollments[0]?.classGroup?.course?.name ?? null,
      }));
    }

    case "STUDENTS_ACTIVE": {
      const enrollments = await prisma.enrollment.findMany({
        where: { status: "ACTIVE" },
        select: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              deletedAt: true,
              user: { select: { email: true } },
            },
          },
          classGroup: {
            select: { course: { select: { name: true } } },
          },
        },
      });
      const byStudent = new Map<string, EmailAudienceRecipient>();
      for (const e of enrollments) {
        if (e.student.deletedAt) continue;
        if (byStudent.has(e.student.id)) continue;
        byStudent.set(e.student.id, {
          recipientType: "student",
          recipientId: e.student.id,
          name: e.student.name,
          email: studentEmail(e.student.email, e.student.user?.email ?? null),
          classGroupName: e.classGroup.course.name,
          courseName: e.classGroup.course.name,
        });
      }
      return Array.from(byStudent.values());
    }

    case "STUDENTS_INACTIVE": {
      const activeIds = await prisma.enrollment
        .findMany({
          where: { status: "ACTIVE" },
          select: { studentId: true },
          distinct: ["studentId"],
        })
        .then((r) => new Set(r.map((x) => x.studentId)));
      const students = await prisma.student.findMany({
        where: {
          deletedAt: null,
          id: { notIn: Array.from(activeIds) },
        },
        select: {
          id: true,
          name: true,
          email: true,
          user: { select: { email: true } },
          enrollments: {
            take: 1,
            orderBy: { enrolledAt: "desc" },
            select: {
              classGroup: {
                select: { course: { select: { name: true } } },
              },
            },
          },
        },
      });
      return students.map((s) => ({
        recipientType: "student" as const,
        recipientId: s.id,
        name: s.name,
        email: studentEmail(s.email, s.user?.email ?? null),
        classGroupName: s.enrollments[0]?.classGroup?.course?.name ?? null,
        courseName: s.enrollments[0]?.classGroup?.course?.name ?? null,
      }));
    }

    case "BY_COURSE": {
      const courseId = filters?.courseId;
      if (!courseId) return [];
      const enrollments = await prisma.enrollment.findMany({
        where: {
          status: "ACTIVE",
          classGroup: { courseId },
        },
        select: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              deletedAt: true,
              user: { select: { email: true } },
            },
          },
          classGroup: {
            select: { course: { select: { name: true } } },
          },
        },
      });
      const byStudent = new Map<string, EmailAudienceRecipient>();
      for (const e of enrollments) {
        if (e.student.deletedAt) continue;
        if (byStudent.has(e.student.id)) continue;
        byStudent.set(e.student.id, {
          recipientType: "student",
          recipientId: e.student.id,
          name: e.student.name,
          email: studentEmail(e.student.email, e.student.user?.email ?? null),
          classGroupName: e.classGroup.course.name,
          courseName: e.classGroup.course.name,
        });
      }
      return Array.from(byStudent.values());
    }

    case "TEACHERS": {
      const teachers = await prisma.teacher.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          user: { select: { email: true } },
        },
      });
      return teachers.map((t) => ({
        recipientType: "teacher" as const,
        recipientId: t.id,
        name: t.name,
        email: teacherEmail(t.email, t.user?.email ?? null),
        classGroupName: null,
        courseName: null,
      }));
    }

    case "ADMINS": {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [{ role: "ADMIN" }, { role: "MASTER" }, { isAdmin: true }],
        },
        select: { id: true, name: true, email: true },
      });
      return users.map((u) => ({
        recipientType: "user" as const,
        recipientId: u.id,
        name: u.name,
        email: u.email?.trim() || null,
        classGroupName: null,
        courseName: null,
      }));
    }

    case "ALL_ACTIVE_USERS": {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true },
      });
      return users.map((u) => ({
        recipientType: "user" as const,
        recipientId: u.id,
        name: u.name,
        email: u.email?.trim() || null,
        classGroupName: null,
        courseName: null,
      }));
    }

    default:
      return [];
  }
}
