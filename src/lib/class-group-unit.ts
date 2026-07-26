/**
 * Rótulo e agrupamento de turmas por polo/unidade.
 *
 * Uma turma pode apontar para um `PoloLocation` (caminho recomendado) ou trazer apenas o
 * texto livre `location`, que é o formato das turmas antigas. Estas funções concentram esse
 * fallback para que as telas não repitam a regra.
 */

export type ClassGroupUnit = {
  id: string;
  name: string;
  poloId: string;
  poloName: string;
} | null;

export const UNIT_UNDEFINED_LABEL = "Local a definir";

/** Nome da unidade para exibição (ex.: "Unidade 14 de Abril"). */
export function classGroupUnitLabel(unit: ClassGroupUnit, location: string | null): string {
  if (unit) return unit.name;
  const free = location?.trim();
  return free || UNIT_UNDEFINED_LABEL;
}

/** Município/polo da unidade, quando conhecido (ex.: "Belém"). Serve como contexto do rótulo. */
export function classGroupPoloLabel(unit: ClassGroupUnit): string | null {
  return unit?.poloName?.trim() || null;
}

/**
 * Chave estável para agrupar turmas na mesma unidade. Turmas legadas caem no texto livre,
 * então duas grafias diferentes do mesmo local viram grupos distintos — comportamento
 * preferível a fundir locais que podem não ser o mesmo.
 */
export function classGroupUnitGroupKey(unit: ClassGroupUnit, location: string | null): string {
  if (unit) return `unit:${unit.id}`;
  const free = location?.trim().toLowerCase();
  return free ? `location:${free}` : "unit:undefined";
}
