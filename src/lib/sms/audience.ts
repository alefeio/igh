import { prisma } from "@/lib/prisma";
import type { SmsAudienceType } from "@/generated/prisma/client";

export interface AudienceRecipient {
  recipientType: "student" | "teacher" | "user";
  recipientId: string;
  name: string;
  phone: string | null;
  /** Turma (nome do grupo) para placeholder */
  classGroupName?: string | null;
  /** Nome do curso para placeholder */
  courseName?: string | null;
}

export type AudienceFilters = {
  classGroupId?: string;
  courseId?: string;
  [key: string]: unknown;
};

/**
 * Resolve a lista de destinatários conforme tipo de público e filtros.
 * Telefone pode ser null (ex.: professor sem phone, admin sem vínculo).
 */
export async function resolveSmsAudience(
  audienceType: SmsAudienceType,
  filters: AudienceFilters | null
): Promise<AudienceRecipient[]> {
  switch (audienceType) {
    case "ALL_STUDENTS": {
      const students = await prisma.student.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          phone: true,
          enrollments: {
            where: { status: "ACTIVE" },
            take: 1,
            select: {
              classGroup: {
                select: {
                  id: true,
                  course: { select: { name: true } },
                },
              },
            },
          },
        },
      });
      return students.map((s) => ({
        recipientType: "student" as const,
        recipientId: s.id,
        name: s.name,
        phone: s.phone,
        classGroupName: s.enrollments[0]?.classGroup
          ? `${s.enrollments[0].classGroup.course.name}`
          : null,
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
              phone: true,
            },
          },
          classGroup: {
            select: {
              course: { select: { name: true } },
            },
          },
        },
      });
      return enrollments.map((e) => ({
        recipientType: "student" as const,
        recipientId: e.student.id,
        name: e.student.name,
        phone: e.student.phone,
        classGroupName: e.classGroup.course.name,
        courseName: e.classGroup.course.name,
      }));
    }

    case "STUDENTS_INCOMPLETE": {
      const students = await prisma.student.findMany({
        where: { deletedAt: null, OR: [{ email: null }, { email: "" }] },
        select: {
          id: true,
          name: true,
          phone: true,
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
        phone: s.phone,
        classGroupName: s.enrollments[0]?.classGroup?.course?.name ?? null,
        courseName: s.enrollments[0]?.classGroup?.course?.name ?? null,
      }));
    }

    case "STUDENTS_COMPLETE": {
      const students = await prisma.student.findMany({
        where: {
          deletedAt: null,
          AND: [{ email: { not: null } }, { email: { not: "" } }],
        },
        select: {
          id: true,
          name: true,
          phone: true,
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
        phone: s.phone,
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
              phone: true,
              deletedAt: true,
            },
          },
          classGroup: {
            select: { course: { select: { name: true } } },
          },
        },
      });
      const byStudent = new Map<string, AudienceRecipient>();
      for (const e of enrollments) {
        if (e.student.deletedAt) continue;
        if (byStudent.has(e.student.id)) continue;
        byStudent.set(e.student.id, {
          recipientType: "student",
          recipientId: e.student.id,
          name: e.student.name,
          phone: e.student.phone,
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
          phone: true,
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
        phone: s.phone,
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
              phone: true,
              deletedAt: true,
            },
          },
          classGroup: {
            select: { course: { select: { name: true } } },
          },
        },
      });
      const byStudent = new Map<string, AudienceRecipient>();
      for (const e of enrollments) {
        if (e.student.deletedAt) continue;
        if (byStudent.has(e.student.id)) continue;
        byStudent.set(e.student.id, {
          recipientType: "student",
          recipientId: e.student.id,
          name: e.student.name,
          phone: e.student.phone,
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
          phone: true,
        },
      });
      return teachers.map((t) => ({
        recipientType: "teacher" as const,
        recipientId: t.id,
        name: t.name,
        phone: t.phone,
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
        select: {
          id: true,
          name: true,
          teacher: { select: { phone: true } },
        },
      });
      return users.map((u) => ({
        recipientType: "user" as const,
        recipientId: u.id,
        name: u.name,
        phone: u.teacher?.phone ?? null,
        classGroupName: null,
        courseName: null,
      }));
    }

    case "ALL_ACTIVE_USERS": {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          student: { select: { phone: true } },
          teacher: { select: { phone: true } },
        },
      });
      return users.map((u) => ({
        recipientType: "user" as const,
        recipientId: u.id,
        name: u.name,
        phone: u.student?.phone ?? u.teacher?.phone ?? null,
        classGroupName: null,
        courseName: null,
      }));
    }

    default:
      return [];
  }
}
