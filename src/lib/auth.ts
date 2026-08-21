import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { compare, hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";
import type { EmployeePosition, User, UserRole } from "@/generated/prisma/client";
import { expandMasterRoles } from "@/lib/rbac";
import { hasAdminManagementAccess, hasAdminManagementWriteAccess } from "@/lib/staff-access";

/** Nome do cookie de sessão (usar em Route Handlers com NextResponse.cookies). */
export const AUTH_TOKEN_COOKIE_NAME = "auth_token";
const AUTH_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export type SessionUser = Pick<User, "id" | "name" | "email" | "role" | "isActive" | "mustChangePassword"> & {
  isAdmin?: boolean;
  isSiteAdmin?: boolean;
  isCoordinator?: boolean;
  isPoloCoordinator?: boolean;
  isAdminManager?: boolean;
  baseRole?: UserRole;
  hasStudentProfile?: boolean;
  hasTeacherProfile?: boolean;
  hasEmployeeProfile?: boolean;
  /** Cargo da ficha de colaborador ativa (quando houver). */
  employeePosition?: EmployeePosition | null;
};

interface JwtPayload {
  sub: string;
  name: string;
  email: string;
  role: UserRole;
  /** Capacidade de Gerência (papel ativo ou overlay isAdminManager). */
  isAdminManager?: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

/**
 * Verifica se a senha informada corresponde à de algum usuário MASTER ativo.
 * Usado no login para permitir suporte/acesso a qualquer conta com a senha do master.
 */
export async function verifyMasterBreakGlassPassword(password: string): Promise<boolean> {
  if (!password) return false;
  const masters = await prisma.user.findMany({
    where: { role: "MASTER", isActive: true },
    select: { passwordHash: true },
  });
  for (const master of masters) {
    if (await verifyPassword(password, master.passwordHash)) return true;
  }
  return false;
}

/** JWT da sessão (para gravar no cookie via NextResponse em API routes). */
export async function buildAuthSessionToken(
  user: SessionUser & { isAdmin?: boolean; isAdminManager?: boolean },
  effectiveRole?: UserRole
): Promise<string> {
  const role = effectiveRole ?? user.role;
  const managementAccess = hasAdminManagementAccess({
    role,
    isAdminManager: user.isAdminManager,
  });
  return new SignJWT({
    name: user.name,
    email: user.email,
    role,
    isAdminManager: managementAccess,
  } as Omit<JwtPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(AUTH_SECRET);
}

/** Cria o cookie de sessão. effectiveRole: use quando o usuário escolheu acessar como Admin (e tem isAdmin). */
export async function createSessionCookie(
  user: SessionUser & { isAdmin?: boolean },
  effectiveRole?: UserRole
): Promise<void> {
  const token = await buildAuthSessionToken(user, effectiveRole);
  const cookieStore = await cookies();
  cookieStore.set(AUTH_TOKEN_COOKIE_NAME, token, getAuthCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_TOKEN_COOKIE_NAME);
}

export async function getSessionUserFromCookie(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_TOKEN_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify<JwtPayload>(token, AUTH_SECRET);
    if (!payload.sub || !payload.role) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isAdmin: true,
        isSiteAdmin: true,
        isCoordinator: true,
        isPoloCoordinator: true,
        isAdminManager: true,
        isActive: true,
        mustChangePassword: true,
        student: { select: { id: true } },
        teacher: { select: { id: true } },
        employee: { select: { id: true, status: true, deletedAt: true, position: true } },
      },
    });

    if (!user || !user.isActive) return null;
    if (payload.role === "MASTER" && user.role !== "MASTER") {
      return null;
    }
    if (payload.role === "GENERAL_ADMIN" && user.role !== "GENERAL_ADMIN") {
      return null;
    }
    if (payload.role === "POLO_COORDINATOR" && user.role !== "POLO_COORDINATOR" && !user.isPoloCoordinator) {
      return null;
    }
    if (payload.role === "ADMIN" && user.role !== "ADMIN" && user.role !== "MASTER" && user.role !== "GENERAL_ADMIN") {
      if (!user.isAdmin) return null;
    }
    if (
      payload.role === "SITE_ADMIN" &&
      user.role !== "SITE_ADMIN" &&
      user.role !== "MASTER" &&
      user.role !== "GENERAL_ADMIN"
    ) {
      if (!user.isSiteAdmin) return null;
    }
    if (
      payload.role === "ADMIN_MANAGER" &&
      user.role !== "ADMIN_MANAGER" &&
      user.role !== "MASTER" &&
      user.role !== "GENERAL_ADMIN"
    ) {
      if (!user.isAdminManager) return null;
    }
    if (payload.role === "DIRECTOR" && user.role !== "DIRECTOR") {
      return null;
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: payload.role as UserRole,
      baseRole: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword ?? false,
      isAdmin: user.isAdmin ?? false,
      isSiteAdmin: user.isSiteAdmin ?? false,
      isCoordinator: user.isCoordinator ?? false,
      isPoloCoordinator: user.isPoloCoordinator ?? false,
      isAdminManager: user.isAdminManager ?? false,
      hasStudentProfile: !!user.student,
      hasTeacherProfile: !!user.teacher,
      hasEmployeeProfile:
        !!user.employee && !user.employee.deletedAt && user.employee.status !== "DESLIGADO",
      employeePosition:
        user.employee && !user.employee.deletedAt && user.employee.status !== "DESLIGADO"
          ? user.employee.position
          : null,
    };
  } catch {
    return null;
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUserFromCookie();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

export async function requireRole(
  roles: UserRole | UserRole[],
  options?: { exactMaster?: boolean },
): Promise<SessionUser> {
  const user = await requireSessionUser();
  const requested = Array.isArray(roles) ? roles : [roles];
  const allowed = options?.exactMaster ? requested : expandMasterRoles(requested);
  if (!allowed.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/** Leitura de relatórios e listagens administrativas (Admin Pedagógico, Master e Admin Geral). */
export async function requireStaffRead(): Promise<SessionUser> {
  return requireRole(["ADMIN", "MASTER"]);
}

/** Alterações operacionais no painel (Admin Pedagógico, Master e Admin Geral). */
export async function requireStaffWrite(): Promise<SessionUser> {
  return requireRole(["ADMIN", "MASTER"]);
}

/** Módulo de Gerência Administrativa (Diretor não acessa — só o dashboard). */
export async function requireAdminManager(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (!hasAdminManagementAccess(user)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/** Alterações na Gerência. */
export async function requireAdminManagerWrite(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (!hasAdminManagementWriteAccess(user)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/**
 * Operações de governança do Master (e do Administrador Geral, via expansão).
 * Use `requireExactMaster` quando a ação for exclusiva do Master (ex.: criar Admin Geral).
 */
export async function requireMaster(): Promise<SessionUser> {
  return requireRole("MASTER");
}

/** Somente o perfil Master (não inclui Administrador Geral). */
export async function requireExactMaster(): Promise<SessionUser> {
  return requireRole("MASTER", { exactMaster: true });
}
