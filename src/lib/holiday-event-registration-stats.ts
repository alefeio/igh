import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { STUDENT_VISIBLE_ENROLLMENT_STATUSES } from "@/lib/student-enrollment-access";

/** Cópia mutável — Prisma não aceita `readonly string[]` em `status.in`. */
const visibleEnrollmentStatuses: string[] = [...STUDENT_VISIBLE_ENROLLMENT_STATUSES];

const enrollmentSelect = {
  status: true,
  classGroup: {
    select: {
      name: true,
      status: true,
      course: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.EnrollmentSelect;

export type HolidayEventStudentCourse = {
  courseId: string;
  courseName: string;
  classGroupName: string;
  enrollmentStatus: string;
  classGroupStatus: string;
};

export type HolidayEventStudentLink = {
  studentId: string;
  name: string;
  match: "user" | "email" | "cpf";
  courses: HolidayEventStudentCourse[];
};

function mapCourses(
  enrollments: Array<{
    status: string;
    classGroup: {
      name: string;
      status: string;
      course: { id: string; name: string };
    };
  }>,
): HolidayEventStudentCourse[] {
  return enrollments.map((e) => ({
    courseId: e.classGroup.course.id,
    courseName: e.classGroup.course.name,
    classGroupName: e.classGroup.name,
    enrollmentStatus: e.status,
    classGroupStatus: e.classGroup.status,
  }));
}

function normalizeEmail(value: string | null | undefined): string | null {
  const t = value?.trim().toLowerCase();
  return t && t.includes("@") ? t : null;
}

function normalizeCpf(value: string | null | undefined): string | null {
  const d = (value ?? "").replace(/\D/g, "");
  return d.length === 11 ? d : null;
}

/**
 * Resolve vínculo de aluno (matrículas/cursos) para cada inscrição do evento.
 * Prioridade: User → Student; senão match por e-mail/CPF do convidado.
 */
export async function resolveHolidayRegistrationStudentLinks(
  registrations: Array<{
    id: string;
    guestEmail: string | null;
    guestCpf: string | null;
    user: {
      id: string;
      email: string;
      student: {
        id: string;
        name: string;
        enrollments: Array<{
          status: string;
          classGroup: {
            name: string;
            status: string;
            course: { id: string; name: string };
          };
        }>;
      } | null;
    } | null;
  }>,
): Promise<Map<string, HolidayEventStudentLink>> {
  const result = new Map<string, HolidayEventStudentLink>();
  const needEmail = new Set<string>();
  const needCpf = new Set<string>();

  for (const row of registrations) {
    if (row.user?.student) {
      result.set(row.id, {
        studentId: row.user.student.id,
        name: row.user.student.name,
        match: "user",
        courses: mapCourses(row.user.student.enrollments),
      });
      continue;
    }
    const email = normalizeEmail(row.user?.email ?? row.guestEmail);
    const cpf = normalizeCpf(row.guestCpf);
    if (email) needEmail.add(email);
    if (cpf) needCpf.add(cpf);
  }

  if (needEmail.size === 0 && needCpf.size === 0) return result;

  const matched = await prisma.student.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...(needEmail.size
          ? [{ email: { in: [...needEmail], mode: "insensitive" as const } }]
          : []),
        ...(needCpf.size ? [{ cpf: { in: [...needCpf] } }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      cpf: true,
      enrollments: {
        where: { status: { in: visibleEnrollmentStatuses } },
        select: enrollmentSelect,
      },
    },
  });

  const byEmail = new Map<string, (typeof matched)[number]>();
  const byCpf = new Map<string, (typeof matched)[number]>();
  for (const s of matched) {
    const em = normalizeEmail(s.email);
    const cpf = normalizeCpf(s.cpf);
    if (em) byEmail.set(em, s);
    if (cpf) byCpf.set(cpf, s);
  }

  for (const row of registrations) {
    if (result.has(row.id)) continue;
    const email = normalizeEmail(row.user?.email ?? row.guestEmail);
    const cpf = normalizeCpf(row.guestCpf);
    const viaEmail = email ? byEmail.get(email) : undefined;
    const viaCpf = !viaEmail && cpf ? byCpf.get(cpf) : undefined;
    const student = viaEmail ?? viaCpf;
    if (!student) continue;
    result.set(row.id, {
      studentId: student.id,
      name: student.name,
      match: viaEmail ? "email" : "cpf",
      courses: mapCourses(student.enrollments),
    });
  }

  return result;
}

export const holidayRegistrationUserInclude = {
  id: true,
  name: true,
  email: true,
  whatsapp: true,
  student: {
    select: {
      id: true,
      name: true,
      enrollments: {
        where: { status: { in: visibleEnrollmentStatuses } },
        select: enrollmentSelect,
      },
    },
  },
} satisfies Prisma.UserSelect;
