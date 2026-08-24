/** Restrições do modal Nova turma para coordenador de polo. */

export const POLO_COORDINATOR_INTRO_INFORMATICA_LABEL = "Introdução à Informática (10h)";

function fold(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Rótulo como no select de turmas: nome + (Nh) se a carga não vier no nome. */
export function classGroupCourseSelectLabel(name: string, workloadHours: number | null | undefined): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (/\(\s*\d+\s*h\s*\)\s*$/i.test(trimmed)) return trimmed;
  if (workloadHours != null && workloadHours > 0) return `${trimmed} (${workloadHours}h)`;
  return trimmed;
}

export function isPoloCoordinatorIntroInformaticaCourse(course: {
  name: string;
  workloadHours?: number | null;
}): boolean {
  const label = classGroupCourseSelectLabel(course.name, course.workloadHours ?? null);
  return fold(label) === fold(POLO_COORDINATOR_INTRO_INFORMATICA_LABEL);
}

export function poloCoordinatorCreateClassGroupError(params: {
  cycleId: string;
  currentCycleId: string | null;
  course: { name: string; workloadHours?: number | null } | null;
  isExternal: boolean | undefined;
}): string | null {
  if (!params.currentCycleId || params.cycleId !== params.currentCycleId) {
    return "Coordenadores de polo só podem criar turmas no ciclo atual.";
  }
  if (!params.course || !isPoloCoordinatorIntroInformaticaCourse(params.course)) {
    return `Coordenadores de polo só podem criar turmas do curso ${POLO_COORDINATOR_INTRO_INFORMATICA_LABEL}.`;
  }
  if (params.isExternal !== true) {
    return "Coordenadores de polo só podem criar turmas do tipo Externa.";
  }
  return null;
}
