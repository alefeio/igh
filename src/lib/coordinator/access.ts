export const COORDINATOR_PEDAGOGY_ROLES = ["COORDINATOR", "DIRECTOR", "MASTER", "GENERAL_ADMIN"] as const;

export function canViewCoordinatorPedagogy(role: string | null | undefined): boolean {
  return COORDINATOR_PEDAGOGY_ROLES.includes(role as (typeof COORDINATOR_PEDAGOGY_ROLES)[number]);
}
