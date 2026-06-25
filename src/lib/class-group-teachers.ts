import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function classGroupTeacherAccessWhere(teacherId: string): Prisma.ClassGroupWhereInput {
  return {
    OR: [{ teacherId }, { classGroupTeachers: { some: { teacherId } } }],
  };
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
