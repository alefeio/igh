import { requireRole } from "@/lib/auth";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

/** Verifica se o professor (teacherId) é docente de pelo menos uma turma do curso (courseId). */
export async function isTeacherOfCourse(teacherId: string, courseId: string): Promise<boolean> {
  const count = await prisma.classGroup.count({
    where: { teacherId, courseId },
  });
  return count > 0;
}

/**
 * Exige MASTER, ADMIN ou TEACHER. Se TEACHER, verifica se leciona o curso (é professor de alguma turma desse curso).
 * Permite que o professor edite conteúdo das aulas dos cursos que leciona. Todas as alterações são registradas
 * em CourseLesson (lastEditedByUserId, lastEditedAt) e em AuditLog para o master auditar quem alterou cada aula.
 * Retorna { user, teacherId? } ou { err }.
 */
export async function requireCourseEditAccess(courseId: string): Promise<
  | { user: SessionUser; teacherId?: string }
  | { err: Response }
> {
  const user = await requireRole(["MASTER", "ADMIN", "TEACHER"]);
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      return { err: jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403) };
    }
    const ok = await isTeacherOfCourse(teacher.id, courseId);
    if (!ok) {
      return { err: jsonErr("FORBIDDEN", "Você não é professor deste curso.", 403) };
    }
    return { user, teacherId: teacher.id };
  }
  return { user };
}
