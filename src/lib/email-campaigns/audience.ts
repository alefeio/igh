import { prisma } from "@/lib/prisma";
import type { EmailAudienceType } from "@/generated/prisma/client";
import { formatDateOnly } from "@/lib/format";

export interface EmailAudienceRecipient {
  recipientType: "student" | "teacher" | "user";
  recipientId: string;
  name: string;
  /** E-mail usado para envio: Student.email ?? User.email, Teacher.email ?? User.email, User.email */
  email: string | null;
  /** Matrículas ativas do aluno (quando aplicável). */
  enrollments?: Array<{
    courseName: string | null;
    turmaLine: string | null;
    dataInicio: string | null;
    horario: string | null;
    local: string | null;
  }>;
  /** @deprecated use turmaLine — mantido para compat. */
  classGroupName?: string | null;
  courseName?: string | null;
  /** Dias · horário · local (para placeholder {turma}) */
  turmaLine?: string | null;
  dataInicio?: string | null;
  horario?: string | null;
  local?: string | null;
}

const CLASS_GROUP_DETAIL = {
  startDate: true,
  daysOfWeek: true,
  startTime: true,
  endTime: true,
  location: true,
  course: { select: { name: true } },
} as const;

type CgDetail = {
  startDate: Date;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  location: string | null;
  course: { name: string };
};

function fieldsFromClassGroup(cg: CgDetail | null | undefined) {
  if (!cg) {
    return {
      classGroupName: null as string | null,
      courseName: null as string | null,
      turmaLine: null as string | null,
      dataInicio: null as string | null,
      horario: null as string | null,
      local: null as string | null,
    };
  }
  const loc = cg.location?.trim() ?? "";
  const days = Array.isArray(cg.daysOfWeek) && cg.daysOfWeek.length ? cg.daysOfWeek.join(", ") : "";
  const horario = `${cg.startTime} – ${cg.endTime}`;
  const turmaLine = [days, `${cg.startTime}–${cg.endTime}`, loc || null].filter(Boolean).join(" · ");
  return {
    courseName: cg.course.name,
    classGroupName: turmaLine,
    turmaLine,
    dataInicio: formatDateOnly(cg.startDate),
    horario,
    local: loc || "—",
  };
}

function enrollmentDetailsFromClassGroup(cg: CgDetail | null | undefined) {
  const f = fieldsFromClassGroup(cg);
  return {
    courseName: f.courseName ?? null,
    turmaLine: f.turmaLine ?? null,
    dataInicio: f.dataInicio ?? null,
    horario: f.horario ?? null,
    local: f.local ?? null,
  };
}

export type EmailAudienceFilters = {
  classGroupId?: string;
  courseId?: string;
  /** IDs de alunos (público SPECIFIC_STUDENTS) */
  studentIds?: string[];
  [key: string]: unknown;
};

/**
 * Reconstroi o destinatário como na resolução de audiência, para re-renderizar placeholders no envio
 * (campanhas antigas com HTML congelado sem substituir {cursos_html}, etc.).
 */
export async function loadRecipientForPlaceholderRender(
  recipientType: string,
  recipientId: string,
  name: string,
  audienceType: EmailAudienceType,
  filters: EmailAudienceFilters | null
): Promise<EmailAudienceRecipient> {
  const base: EmailAudienceRecipient = {
    recipientType: recipientType as EmailAudienceRecipient["recipientType"],
    recipientId,
    name,
    email: null,
  };
  if (recipientType !== "student") {
    return base;
  }
  const fg = filters ?? {};

  if (audienceType === "CLASS_GROUP" && fg.classGroupId) {
    const e = await prisma.enrollment.findFirst({
      where: { studentId: recipientId, classGroupId: fg.classGroupId, status: "ACTIVE" },
      select: { classGroup: { select: CLASS_GROUP_DETAIL } },
    });
    const f = fieldsFromClassGroup(e?.classGroup ?? undefined);
    return {
      ...base,
      ...f,
      enrollments: e?.classGroup ? [enrollmentDetailsFromClassGroup(e.classGroup)] : [],
    };
  }

  if (audienceType === "BY_COURSE" && fg.courseId) {
    const list = await prisma.enrollment.findMany({
      where: { studentId: recipientId, status: "ACTIVE", classGroup: { courseId: fg.courseId } },
      orderBy: { enrolledAt: "desc" },
      select: { classGroup: { select: CLASS_GROUP_DETAIL } },
    });
    const primary = list[0]?.classGroup ?? undefined;
    const f = fieldsFromClassGroup(primary);
    return {
      ...base,
      ...f,
      enrollments: list.map((x) => enrollmentDetailsFromClassGroup(x.classGroup ?? undefined)),
    };
  }

  if (
    audienceType === "ALL_STUDENTS" ||
    audienceType === "STUDENTS_COMPLETE" ||
    audienceType === "STUDENTS_INCOMPLETE" ||
    audienceType === "STUDENTS_ACTIVE" ||
    audienceType === "STUDENTS_INACTIVE"
  ) {
    const e = await prisma.enrollment.findFirst({
      where: { studentId: recipientId, status: "ACTIVE" },
      orderBy: { enrolledAt: "desc" },
      select: { classGroup: { select: CLASS_GROUP_DETAIL } },
    });
    const f = fieldsFromClassGroup(e?.classGroup ?? undefined);
    return {
      ...base,
      ...f,
      enrollments: e?.classGroup ? [enrollmentDetailsFromClassGroup(e.classGroup)] : [],
    };
  }

  const list = await prisma.enrollment.findMany({
    where: { studentId: recipientId, status: "ACTIVE" },
    orderBy: { enrolledAt: "desc" },
    select: { classGroup: { select: CLASS_GROUP_DETAIL } },
  });
  const primary = list[0]?.classGroup ?? undefined;
  const f = fieldsFromClassGroup(primary);
  return {
    ...base,
    ...f,
    enrollments: list.map((x) => enrollmentDetailsFromClassGroup(x.classGroup ?? undefined)),
  };
}

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
                select: CLASS_GROUP_DETAIL,
              },
            },
          },
        },
      });
      return students.map((s) => {
        const f = fieldsFromClassGroup(s.enrollments[0]?.classGroup ?? undefined);
        return {
          recipientType: "student" as const,
          recipientId: s.id,
          name: s.name,
          email: studentEmail(s.email, s.user?.email ?? null),
          ...f,
        };
      });
    }

    case "ENROLLED_STUDENTS": {
      // "Matriculados" = alunos com ao menos 1 matrícula ativa.
      // Guardamos TODAS as matrículas ativas para permitir placeholders agregados (vários cursos/turmas).
      const students = await prisma.student.findMany({
        where: {
          deletedAt: null,
          enrollments: { some: { status: "ACTIVE" } },
        },
        select: {
          id: true,
          name: true,
          email: true,
          user: { select: { email: true } },
          enrollments: {
            where: { status: "ACTIVE" },
            orderBy: { enrolledAt: "desc" },
            select: { classGroup: { select: CLASS_GROUP_DETAIL } },
          },
        },
      });

      return students.map((s) => {
        const primary = s.enrollments[0]?.classGroup ?? undefined;
        const f = fieldsFromClassGroup(primary);
        const enrollments = s.enrollments.map((e) =>
          enrollmentDetailsFromClassGroup(e.classGroup ?? undefined)
        );
        return {
          recipientType: "student" as const,
          recipientId: s.id,
          name: s.name,
          email: studentEmail(s.email, s.user?.email ?? null),
          enrollments,
          ...f,
        };
      });
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
            select: CLASS_GROUP_DETAIL,
          },
        },
      });
      return enrollments.map((e) => {
        const f = fieldsFromClassGroup(e.classGroup);
        return {
          recipientType: "student" as const,
          recipientId: e.student.id,
          name: e.student.name,
          email: studentEmail(e.student.email, e.student.user?.email ?? null),
          ...f,
        };
      });
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
                select: CLASS_GROUP_DETAIL,
              },
            },
          },
        },
      });
      const withoutValidEmail = students.filter(
        (s) => !studentEmail(s.email, s.user?.email ?? null)
      );
      return withoutValidEmail.map((s) => {
        const f = fieldsFromClassGroup(s.enrollments[0]?.classGroup ?? undefined);
        return {
          recipientType: "student" as const,
          recipientId: s.id,
          name: s.name,
          email: null as string | null,
          ...f,
        };
      });
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
                select: CLASS_GROUP_DETAIL,
              },
            },
          },
        },
      });
      const withEmail = students.filter((s) =>
        studentEmail(s.email, s.user?.email ?? null)
      );
      return withEmail.map((s) => {
        const f = fieldsFromClassGroup(s.enrollments[0]?.classGroup ?? undefined);
        return {
          recipientType: "student" as const,
          recipientId: s.id,
          name: s.name,
          email: studentEmail(s.email, s.user?.email ?? null)!,
          ...f,
        };
      });
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
            select: CLASS_GROUP_DETAIL,
          },
        },
      });
      const byStudent = new Map<string, EmailAudienceRecipient>();
      for (const e of enrollments) {
        if (e.student.deletedAt) continue;
        if (byStudent.has(e.student.id)) continue;
        const f = fieldsFromClassGroup(e.classGroup);
        byStudent.set(e.student.id, {
          recipientType: "student",
          recipientId: e.student.id,
          name: e.student.name,
          email: studentEmail(e.student.email, e.student.user?.email ?? null),
          ...f,
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
                select: CLASS_GROUP_DETAIL,
              },
            },
          },
        },
      });
      return students.map((s) => {
        const f = fieldsFromClassGroup(s.enrollments[0]?.classGroup ?? undefined);
        return {
          recipientType: "student" as const,
          recipientId: s.id,
          name: s.name,
          email: studentEmail(s.email, s.user?.email ?? null),
          ...f,
        };
      });
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
            select: CLASS_GROUP_DETAIL,
          },
        },
      });
      const byStudent = new Map<string, EmailAudienceRecipient>();
      for (const e of enrollments) {
        if (e.student.deletedAt) continue;
        if (byStudent.has(e.student.id)) continue;
        const f = fieldsFromClassGroup(e.classGroup);
        byStudent.set(e.student.id, {
          recipientType: "student",
          recipientId: e.student.id,
          name: e.student.name,
          email: studentEmail(e.student.email, e.student.user?.email ?? null),
          ...f,
        });
      }
      return Array.from(byStudent.values());
    }

    case "SPECIFIC_STUDENTS": {
      const rawIds = Array.isArray(filters?.studentIds)
        ? (filters!.studentIds as string[]).filter(
            (id) => typeof id === "string" && id.length > 0
          )
        : [];
      const ids = [...new Set(rawIds)];
      if (ids.length === 0) return [];
      const students = await prisma.student.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          user: { select: { email: true } },
          enrollments: {
            where: { status: "ACTIVE" },
            take: 1,
            select: { classGroup: { select: CLASS_GROUP_DETAIL } },
          },
        },
      });
      const byId = new Map(students.map((s) => [s.id, s]));
      return ids
        .map((id) => byId.get(id))
        .filter((s): s is NonNullable<typeof s> => s != null)
        .map((s) => {
          const f = fieldsFromClassGroup(s.enrollments[0]?.classGroup ?? undefined);
          return {
            recipientType: "student" as const,
            recipientId: s.id,
            name: s.name,
            email: studentEmail(s.email, s.user?.email ?? null),
            ...f,
          };
        });
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
