import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { compare, hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";
import type { User, UserRole } from "@/generated/prisma/client";

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
  baseRole?: UserRole;
  hasStudentProfile?: boolean;
  hasTeacherProfile?: boolean;
};

interface JwtPayload {
  sub: string;
  name: string;
  email: string;
  role: UserRole;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

/** JWT da sessão (para gravar no cookie via NextResponse em API routes). */
export async function buildAuthSessionToken(
  user: SessionUser & { isAdmin?: boolean },
  effectiveRole?: UserRole
): Promise<string> {
  const role = effectiveRole ?? user.role;
  return new SignJWT({
    name: user.name,
    email: user.email,
    role,
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
        isActive: true,
        mustChangePassword: true,
        student: { select: { id: true } },
        teacher: { select: { id: true } },
      },
    });

    if (!user || !user.isActive) return null;
    if (payload.role === "ADMIN" && user.role !== "ADMIN" && user.role !== "MASTER") {
      if (!user.isAdmin) return null;
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
      hasStudentProfile: !!user.student,
      hasTeacherProfile: !!user.teacher,
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

export async function requireRole(roles: UserRole | UserRole[]): Promise<SessionUser> {
  const user = await requireSessionUser();
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
