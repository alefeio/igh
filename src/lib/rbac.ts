import type { UserRole } from "@/generated/prisma/client";

export const MASTER_ONLY: UserRole[] = ["MASTER"];
/** Master e Administrador Geral — governança plena (exceto criar/editar Admin Geral). */
export const MASTER_OR_GENERAL_ADMIN: UserRole[] = ["MASTER", "GENERAL_ADMIN"];
export const MASTER_OR_ADMIN: UserRole[] = ["MASTER", "GENERAL_ADMIN", "ADMIN"];

export function isExactMaster(user: { role?: string | null; baseRole?: string | null }): boolean {
  return user.role === "MASTER" || user.baseRole === "MASTER";
}

export function isMasterOrGeneralAdmin(user: { role?: string | null; baseRole?: string | null }): boolean {
  return (
    user.role === "MASTER" ||
    user.role === "GENERAL_ADMIN" ||
    user.baseRole === "MASTER" ||
    user.baseRole === "GENERAL_ADMIN"
  );
}

/** Expande MASTER para incluir GENERAL_ADMIN nas checagens de permissão. */
export function expandMasterRoles(roles: readonly UserRole[]): UserRole[] {
  const list = [...roles];
  if (list.includes("MASTER") && !list.includes("GENERAL_ADMIN")) {
    list.push("GENERAL_ADMIN");
  }
  return list;
}
