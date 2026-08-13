import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function classGroupTeacherAccessWhere(teacherId: string): Prisma.ClassGroupWhereInput {
  return {
    OR: [{ teacherId }, { classGroupTeachers: { some: { teacherId } } }],
  };
}

/** Verifica se o professor (titular ou co-professor) tem acesso à turma. */
export async function teacherOwnsClassGroup(
  teacherId: string,
  classGroupId: string,
): Promise<boolean> {
  const cg = await prisma.classGroup.findFirst({
    where: { id: classGroupId, ...classGroupTeacherAccessWhere(teacherId) },
    select: { id: true },
  });
  return !!cg;
}

/** Verifica se a matrícula está em turma do professor (titular/co-professor). */
export async function teacherOwnsEnrollment(
  teacherId: string,
  enrollmentId: string,
): Promise<boolean> {
  const row = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      classGroup: classGroupTeacherAccessWhere(teacherId),
    },
    select: { id: true },
  });
  return !!row;
}

/** Resolve o Teacher.id a partir do User.id (ou null se não houver perfil ativo). */
export async function resolveTeacherIdForUser(userId: string): Promise<string | null> {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  return teacher?.id ?? null;
}

export async function syncClassGroupTeachers(
  classGroupId: string,
  teacherIds: string[],
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  const uniqueIds = [...new Set(teacherIds)];
  await client.classGroupTeacher.deleteMany({ where: { classGroupId } });
  if (uniqueIds.length === 0) return;
  await client.classGroupTeacher.createMany({
    data: uniqueIds.map((teacherId) => ({ classGroupId, teacherId })),
    skipDuplicates: true,
  });
}

export function formatClassGroupTeacherNames(
  teachers: { name: string }[],
  fallback?: { name: string } | null
): string {
  if (teachers.length > 0) return teachers.map((t) => t.name).join(", ");
  return fallback?.name ?? "—";
}

export async function validateTeacherIds(teacherIds: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const uniqueIds = [...new Set(teacherIds)];
  if (uniqueIds.length === 0) {
    return { ok: false, message: "Selecione ao menos um professor." };
  }
  const rows = await prisma.teacher.findMany({
    where: { id: { in: uniqueIds }, deletedAt: null },
    select: { id: true },
  });
  if (rows.length !== uniqueIds.length) {
    return { ok: false, message: "Um ou mais professores selecionados são inválidos." };
  }
  return { ok: true };
}
