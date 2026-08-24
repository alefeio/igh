import { MIN_AGGREGATE_GROUP_SIZE, shouldSuppressSensitiveGroup } from "@/lib/diretor/lgpd";

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Novo: primeira presença elegível da pessoa ocorreu no período.
 * Recorrente: atendida no período e já tinha presença elegível antes do início.
 * Duas matrículas no mesmo período não tornam a pessoa recorrente.
 */
export function classifyNewVsRecurrent(params: {
  servedIds: string[];
  previouslyServedIds: string[];
}): { newIds: string[]; recurrentIds: string[] } {
  const prev = new Set(params.previouslyServedIds);
  const newIds: string[] = [];
  const recurrentIds: string[] = [];
  for (const id of uniqueIds(params.servedIds)) {
    if (prev.has(id)) recurrentIds.push(id);
    else newIds.push(id);
  }
  return { newIds, recurrentIds };
}

/** Indicador separado: mais de um curso/turma no recorte. Não altera novo/recorrente. */
export function multiCourseStudentIds(enrollmentsByStudent: Map<string, Set<string>>): string[] {
  const ids: string[] = [];
  for (const [studentId, courses] of enrollmentsByStudent) {
    if (courses.size > 1) ids.push(studentId);
  }
  return ids;
}

/** Meta de pessoas não é comparável a “atendidos únicos” sem definição institucional. */
export function peopleGoalComparable(): false {
  return false;
}

export function computersProgress(done: number, target: number): number | null {
  if (target <= 0) return null;
  return Math.round((done / target) * 1000) / 10;
}

export function lgpdCount(n: number): number | string {
  if (shouldSuppressSensitiveGroup(n, MIN_AGGREGATE_GROUP_SIZE)) return `<${MIN_AGGREGATE_GROUP_SIZE}`;
  return n;
}
