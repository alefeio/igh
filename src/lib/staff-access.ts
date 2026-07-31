export type StaffAccessRole = "ADMIN" | "COORDINATOR" | "POLO_COORDINATOR";
export type ManagedAccessRole = StaffAccessRole | "GENERAL_ADMIN";

export const STAFF_ACCESS_ROLES: readonly StaffAccessRole[] = [
  "ADMIN",
  "COORDINATOR",
  "POLO_COORDINATOR",
] as const;

export const STAFF_ACCESS_LABEL: Record<StaffAccessRole, string> = {
  ADMIN: "Admin",
  COORDINATOR: "Coordenador",
  POLO_COORDINATOR: "Coordenador de Polos",
};

export const MANAGED_ACCESS_LABEL: Record<ManagedAccessRole, string> = {
  ...STAFF_ACCESS_LABEL,
  GENERAL_ADMIN: "Administrador Geral",
};

/** Prioridade ao escolher o papel-base quando vários tipos são marcados. */
const BASE_PRIORITY: readonly StaffAccessRole[] = [
  "ADMIN",
  "COORDINATOR",
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
    // Administrador Geral é papel exclusivo na seleção; vínculos de polo são
    // preservados via isPoloCoordinator na API de usuários.
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
): { isAdmin: boolean; isCoordinator: boolean; isPoloCoordinator: boolean } {
  return {
    isAdmin: roles.includes("ADMIN") && base !== "ADMIN",
    isCoordinator: roles.includes("COORDINATOR") && base !== "COORDINATOR",
    isPoloCoordinator: roles.includes("POLO_COORDINATOR") && base !== "POLO_COORDINATOR",
  };
}

export function userHasStaffAccess(
  user: {
    role: string;
    isAdmin?: boolean;
    isCoordinator?: boolean;
    isPoloCoordinator?: boolean;
  },
  target: StaffAccessRole,
): boolean {
  if (target === "ADMIN") return user.role === "ADMIN" || !!user.isAdmin;
  if (target === "COORDINATOR") return user.role === "COORDINATOR" || !!user.isCoordinator;
  return user.role === "POLO_COORDINATOR" || !!user.isPoloCoordinator;
}

export function staffRolesFromUser(user: {
  role: string;
  isAdmin?: boolean;
  isCoordinator?: boolean;
  isPoloCoordinator?: boolean;
}): StaffAccessRole[] {
  return STAFF_ACCESS_ROLES.filter((r) => userHasStaffAccess(user, r));
}

export function managedRolesFromUser(user: {
  role: string;
  isAdmin?: boolean;
  isCoordinator?: boolean;
  isPoloCoordinator?: boolean;
}): ManagedAccessRole[] {
  if (user.role === "GENERAL_ADMIN") return ["GENERAL_ADMIN"];
  return staffRolesFromUser(user);
}

/**
 * Calcula papel-base + overlays a partir dos tipos marcados.
 * Para aluno/professor/master/admin geral, preserva o papel-base e só ajusta as flags (quando staff).
 */
export function resolveStaffAccessUpdate(
  currentRole: string,
  selected: readonly StaffAccessRole[],
): {
  role?: StaffAccessRole;
  isAdmin: boolean;
  isCoordinator: boolean;
  isPoloCoordinator: boolean;
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
      isCoordinator: roles.includes("COORDINATOR"),
      isPoloCoordinator: roles.includes("POLO_COORDINATOR"),
    };
  }

  const keepBase =
    (currentRole === "ADMIN" || currentRole === "COORDINATOR" || currentRole === "POLO_COORDINATOR") &&
    roles.includes(currentRole as StaffAccessRole)
      ? (currentRole as StaffAccessRole)
      : pickStaffBaseRole(roles);

  return {
    role: keepBase,
    ...staffOverlaysForBase(roles, keepBase),
  };
}
