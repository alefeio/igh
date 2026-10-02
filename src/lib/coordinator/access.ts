export const COORDINATOR_PEDAGOGY_ROLES = ["COORDINATOR", "DIRECTOR", "MASTER", "GENERAL_ADMIN"] as const;

/** Busca ativa compartilhada. Não abre o restante do painel pedagógico. */
export const BUSCA_ATIVA_ROLES = [
  "ADMIN",
  "TEACHER",
  "COORDINATOR",
  "DIRECTOR",
  "MASTER",
  "GENERAL_ADMIN",
] as const;

export function canViewCoordinatorPedagogy(role: string | null | undefined): boolean {
  return COORDINATOR_PEDAGOGY_ROLES.includes(role as (typeof COORDINATOR_PEDAGOGY_ROLES)[number]);
}

export function canUseBuscaAtiva(role: string | null | undefined): boolean {
  return BUSCA_ATIVA_ROLES.includes(role as (typeof BUSCA_ATIVA_ROLES)[number]);
}
