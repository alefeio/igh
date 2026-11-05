import "server-only";

import { prisma } from "@/lib/prisma";
import type { TeacherEvaluationListFilter } from "@/lib/teacher-class-evaluation";

/** Rótulo legível do recorte, sem dados sensíveis. */
export async function describeTeacherEvaluationFilter(filter: TeacherEvaluationListFilter): Promise<string> {
  const parts: string[] = [];
  if (filter.cycleId) {
    const cycle = await prisma.cycle.findUnique({
      where: { id: filter.cycleId },
      select: { cycle: true, year: true },
    });
    parts.push(cycle ? `Ciclo ${cycle.cycle}/${cycle.year}` : "Ciclo selecionado");
  } else {
    parts.push("Todos os ciclos");
  }
  if (filter.courseId) {
    const course = await prisma.course.findUnique({ where: { id: filter.courseId }, select: { name: true } });
    parts.push(course ? `Curso ${course.name}` : "Curso selecionado");
  } else {
    parts.push("Todos os cursos");
  }
  if (filter.teacherId) {
    const teacher = await prisma.teacher.findUnique({ where: { id: filter.teacherId }, select: { name: true } });
    parts.push(teacher ? `Professor ${teacher.name}` : "Professor selecionado");
  } else {
    parts.push("Todos os professores");
  }
  if (filter.classGroupId) {
    parts.push("Turma selecionada");
  } else {
    parts.push("Todas as turmas");
  }
  if (filter.scope === "internal") parts.push("Tipo Da IGH");
  else if (filter.scope === "external") parts.push("Tipo Parceiras");
  else parts.push("Todos os tipos");
  return parts.join(" · ");
}
