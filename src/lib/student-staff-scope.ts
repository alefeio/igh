import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth";
import { classGroupTeacherAccessWhere, resolveTeacherIdForUser } from "@/lib/class-group-teachers";
import { buildEnrollmentWhereForPoloCoordinator } from "@/lib/polo-coordinator-scope";
import { prisma } from "@/lib/prisma";

function isUnrestrictedStaff(role: string): boolean {
  return role === "MASTER" || role === "GENERAL_ADMIN" || role === "ADMIN";
}

/**
 * Recorte de alunos visíveis/editáveis: turmas do professor ou polos do coordenador.
 * `null` = sem recorte (admin/master).
 */
export async function studentWhereInStaffScope(
  user: Pick<SessionUser, "id" | "role">,
): Promise<Prisma.StudentWhereInput | null> {
  if (isUnrestrictedStaff(user.role)) return null;

  if (user.role === "TEACHER") {
    const teacherId = await resolveTeacherIdForUser(user.id);
    if (!teacherId) return { id: { in: [] } };
    return {
      enrollments: { some: { classGroup: classGroupTeacherAccessWhere(teacherId) } },
    };
  }

  if (user.role === "POLO_COORDINATOR") {
    const enrollmentWhere = await buildEnrollmentWhereForPoloCoordinator(user.id);
    return { enrollments: { some: enrollmentWhere } };
  }

  return { id: { in: [] } };
}

/** Professor ou coordenador só acessa aluno matriculado no respectivo escopo. */
export async function staffCanAccessStudent(
  user: Pick<SessionUser, "id" | "role">,
  studentId: string,
): Promise<boolean> {
  if (isUnrestrictedStaff(user.role)) return true;

  if (user.role === "TEACHER") {
    const teacherId = await resolveTeacherIdForUser(user.id);
    if (!teacherId) return false;
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId,
        classGroup: classGroupTeacherAccessWhere(teacherId),
      },
      select: { id: true },
    });
    return !!enrollment;
  }

  if (user.role === "POLO_COORDINATOR") {
    const enrollmentWhere = await buildEnrollmentWhereForPoloCoordinator(user.id);
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, ...enrollmentWhere },
      select: { id: true },
    });
    return !!enrollment;
  }

  return false;
}

/** Combina filtros de aluno sem sobrescrever `enrollments` / `OR`. */
export function andStudentWhere(
  where: Prisma.StudentWhereInput,
  extra: Prisma.StudentWhereInput | null | undefined,
): void {
  if (!extra) return;
  const existing = where.AND;
  const list = Array.isArray(existing) ? [...existing] : existing ? [existing] : [];
  list.push(extra);
  where.AND = list;
}
