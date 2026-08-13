/**
 * Escopo da turma (Interna / Externa), independente do status operacional.
 * Externa: fora do site de inscrição; matrícula por staff privilegiado
 * (Master / Admin Geral / Coordenador) ou professor da própria turma.
 */

export const CLASS_GROUP_OPERATIONAL_ENROLLABLE = [
  "PLANEJADA",
  "ABERTA",
  "EM_ANDAMENTO",
] as const;

export type ClassGroupScopeFields = {
  status: string;
  isExternal?: boolean | null;
};

export function isClassGroupExternal(cg: ClassGroupScopeFields): boolean {
  return cg.isExternal === true;
}

/** Matrícula pelo site / APIs públicas. */
export function classGroupAllowsPublicEnrollment(cg: ClassGroupScopeFields): boolean {
  if (isClassGroupExternal(cg)) return false;
  return (CLASS_GROUP_OPERATIONAL_ENROLLABLE as readonly string[]).includes(cg.status);
}

/**
 * Matrícula pelo painel (staff).
 * `canEnrollExternal` = Master / Admin Geral / Coordenador de polo, ou professor
 * já autorizado na turma (ownership verificado pelo caller).
 */
export function classGroupAllowsStaffEnrollment(
  cg: ClassGroupScopeFields,
  opts: { canEnrollExternal: boolean },
): boolean {
  if (!(CLASS_GROUP_OPERATIONAL_ENROLLABLE as readonly string[]).includes(cg.status)) {
    return false;
  }
  if (isClassGroupExternal(cg) && !opts.canEnrollExternal) return false;
  return true;
}
