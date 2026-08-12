export type StaffAccessRole = "ADMIN" | "ADMIN_MANAGER" | "SITE_ADMIN" | "POLO_COORDINATOR";
export type ManagedAccessRole = StaffAccessRole | "GENERAL_ADMIN";

export const STAFF_ACCESS_ROLES: readonly StaffAccessRole[] = [
  "ADMIN",
  "ADMIN_MANAGER",
  "SITE_ADMIN",
  "POLO_COORDINATOR",
] as const;

export const STAFF_ACCESS_LABEL: Record<StaffAccessRole, string> = {
  ADMIN: "Administrador Pedagógico",
  ADMIN_MANAGER: "Gerência Administrativa",
  SITE_ADMIN: "Administrador Site",
  POLO_COORDINATOR: "Coordenador de Polos",
};

export const MANAGED_ACCESS_LABEL: Record<ManagedAccessRole, string> = {
  ...STAFF_ACCESS_LABEL,
  GENERAL_ADMIN: "Administrador Geral",
};

/** Prioridade ao escolher o papel-base quando vários tipos são marcados. */
const BASE_PRIORITY: readonly StaffAccessRole[] = [
  "ADMIN",
  "ADMIN_MANAGER",
  "SITE_ADMIN",
  "POLO_COORDINATOR",
];

export function normalizeStaffRoles(
  roles: readonly StaffAccessRole[] | undefined,
  fallback?: StaffAccessRole,
): StaffAccessRole[] {
  const unique = Array.from(new Set(roles ?? []));
  if (unique.length > 0) return BASE_PRIORITY.filter((r) => unique.includes(r));
  return [fallback ?? "ADMIN"];
}

export function normalizeManagedRoles(
  roles: readonly ManagedAccessRole[] | undefined,
): ManagedAccessRole[] {
  const unique = Array.from(new Set(roles ?? []));
  if (unique.includes("GENERAL_ADMIN")) {
    return ["GENERAL_ADMIN"];
  }
  return normalizeStaffRoles(unique.filter((r): r is StaffAccessRole => r !== "GENERAL_ADMIN"));
}

export function pickStaffBaseRole(roles: readonly StaffAccessRole[]): StaffAccessRole {
  return BASE_PRIORITY.find((r) => roles.includes(r)) ?? "ADMIN";
}

export function staffOverlaysForBase(
  roles: readonly StaffAccessRole[],
  base: StaffAccessRole,
): {
  isAdmin: boolean;
  isSiteAdmin: boolean;
  isCoordinator: boolean;
  isPoloCoordinator: boolean;
  isAdminManager: boolean;
} {
  return {
    isAdmin: roles.includes("ADMIN") && base !== "ADMIN",
    isSiteAdmin: roles.includes("SITE_ADMIN") && base !== "SITE_ADMIN",
    isCoordinator: false,
    isPoloCoordinator: roles.includes("POLO_COORDINATOR") && base !== "POLO_COORDINATOR",
    isAdminManager: roles.includes("ADMIN_MANAGER") && base !== "ADMIN_MANAGER",
  };
}

export function userHasStaffAccess(
  user: {
    role: string;
    isAdmin?: boolean;
    isSiteAdmin?: boolean;
    isCoordinator?: boolean;
    isPoloCoordinator?: boolean;
    isAdminManager?: boolean;
  },
  target: StaffAccessRole,
): boolean {
  if (target === "ADMIN") return user.role === "ADMIN" || !!user.isAdmin;
  if (target === "ADMIN_MANAGER") return user.role === "ADMIN_MANAGER" || !!user.isAdminManager;
  if (target === "SITE_ADMIN") return user.role === "SITE_ADMIN" || !!user.isSiteAdmin;
  return user.role === "POLO_COORDINATOR" || !!user.isPoloCoordinator;
}

/**
 * Acesso ao módulo Gerência (menu, proxy e APIs): papel ativo Master/Admin Geral/
 * Gerência Administrativa, ou overlay `isAdminManager` atribuído em /users.
 */
export function hasAdminManagementAccess(user: {
  role?: string | null;
  isAdminManager?: boolean | null;
}): boolean {
  const active = user.role ?? "";
  if (active === "ADMIN_MANAGER" || active === "MASTER" || active === "GENERAL_ADMIN") {
    return true;
  }
  return user.isAdminManager === true;
}

export function staffRolesFromUser(user: {
  role: string;
  isAdmin?: boolean;
  isSiteAdmin?: boolean;
  isCoordinator?: boolean;
  isPoloCoordinator?: boolean;
  isAdminManager?: boolean;
}): StaffAccessRole[] {
  return STAFF_ACCESS_ROLES.filter((r) => userHasStaffAccess(user, r));
}

export function managedRolesFromUser(user: {
  role: string;
  isAdmin?: boolean;
  isSiteAdmin?: boolean;
  isCoordinator?: boolean;
  isPoloCoordinator?: boolean;
  isAdminManager?: boolean;
}): ManagedAccessRole[] {
  if (user.role === "GENERAL_ADMIN") return ["GENERAL_ADMIN"];
  return staffRolesFromUser(user);
}

/**
 * Calcula papel-base + overlays a partir dos tipos marcados.
 */
export function resolveStaffAccessUpdate(
  currentRole: string,
  selected: readonly StaffAccessRole[],
): {
  role?: StaffAccessRole;
  isAdmin: boolean;
  isSiteAdmin: boolean;
  isCoordinator: boolean;
  isPoloCoordinator: boolean;
  isAdminManager: boolean;
} {
  const roles = normalizeStaffRoles(selected);
  if (
    currentRole === "STUDENT" ||
    currentRole === "TEACHER" ||
    currentRole === "MASTER" ||
    currentRole === "GENERAL_ADMIN"
  ) {
    return {
      isAdmin: roles.includes("ADMIN"),
      isSiteAdmin: roles.includes("SITE_ADMIN"),
      isCoordinator: false,
      isPoloCoordinator: roles.includes("POLO_COORDINATOR"),
      isAdminManager: roles.includes("ADMIN_MANAGER"),
    };
  }

  const keepBase =
    (currentRole === "ADMIN" ||
      currentRole === "ADMIN_MANAGER" ||
      currentRole === "SITE_ADMIN" ||
      currentRole === "POLO_COORDINATOR") &&
    roles.includes(currentRole as StaffAccessRole)
      ? (currentRole as StaffAccessRole)
      : pickStaffBaseRole(roles);

  return {
    role: keepBase,
    ...staffOverlaysForBase(roles, keepBase),
  };
}
