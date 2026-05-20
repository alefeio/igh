import "server-only";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr } from "@/lib/http";

export async function requireTeacherClassGroup(classGroupId: string) {
  const user = await requireRole(["TEACHER"]);
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return { error: jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403) as never };

  const cg = await prisma.classGroup.findUnique({
    where: { id: classGroupId, teacherId: teacher.id },
    select: { id: true, courseId: true },
  });
  if (!cg) return { error: jsonErr("NOT_FOUND", "Turma não encontrada.", 404) as never };
  return { teacher, classGroup: cg, user };
}

export async function requireStudentEnrollment(enrollmentId: string) {
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) return { error: jsonErr("NOT_FOUND", "Aluno não encontrado.", 404) as never };

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
    include: { classGroup: { select: { id: true, courseId: true } } },
  });
  if (!enrollment) return { error: jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404) as never };
  return { student, enrollment, user };
}
