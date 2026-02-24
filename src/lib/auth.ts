import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { compare, hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";
import type { User, UserRole } from "@/generated/prisma/client";

const AUTH_COOKIE_NAME = "auth_token";
const AUTH_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");

export type SessionUser = Pick<User, "id" | "name" | "email" | "role" | "isActive">;

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

export async function createSessionCookie(user: SessionUser): Promise<void> {
  const token = await new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
  } as Omit<JwtPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(AUTH_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function getSessionUserFromCookie(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
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
        isActive: true,
      },
    });

    if (!user || !user.isActive) return null;
    return user;
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
