import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildAuthSessionToken,
  verifyPassword,
  AUTH_TOKEN_COOKIE_NAME,
  getAuthCookieOptions,
  type SessionUser,
} from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/client";
import { jsonErr } from "@/lib/http";
import { loginSchema } from "@/lib/validators/auth";
import {
  birthDateToStudentPasswordLegacyLocal,
  birthDateToStudentPasswordParts,
} from "@/lib/student-password";

const userLoginSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isAdmin: true,
  isActive: true,
  mustChangePassword: true,
  passwordHash: true,
} as const;

/**
 * Aceita senha no formato atual (UTC/calendário ISO) ou legado (getDate local),
 * desde que o usuário tenha digitado exatamente uma das duas variantes em texto.
 */
async function verifyPasswordForStudentAccount(
  password: string,
  passwordHash: string,
  birthDate: Date
): Promise<boolean> {
  if (await verifyPassword(password, passwordHash)) return true;
  const { password: isoPwd } = birthDateToStudentPasswordParts(birthDate);
  const legPwd = birthDateToStudentPasswordLegacyLocal(birthDate);
  if (password !== isoPwd && password !== legPwd) return false;
  return (
    (await verifyPassword(isoPwd, passwordHash)) || (await verifyPassword(legPwd, passwordHash))
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }

    const { login, password, kind } = parsed.data;

    let user: {
      id: string;
      name: string;
      email: string;
      role: string;
      isAdmin: boolean;
      isActive: boolean;
      mustChangePassword: boolean | null;
      passwordHash: string;
    } | null = null;

    if (kind === "email") {
      user = await prisma.user.findUnique({
        where: { email: login },
        select: userLoginSelect,
      });
    } else {
      const student = await prisma.student.findFirst({
        where: { cpf: login, deletedAt: null, userId: { not: null } },
        select: { userId: true },
      });
      if (student?.userId) {
        user = await prisma.user.findUnique({
          where: { id: student.userId },
          select: userLoginSelect,
        });
      }
    }

    if (!user || !user.isActive) {
      return jsonErr("INVALID_CREDENTIALS", "E-mail/CPF ou senha inválidos.", 401);
    }

    const studentForPassword = await prisma.student.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { birthDate: true },
    });

    const ok = studentForPassword
      ? await verifyPasswordForStudentAccount(password, user.passwordHash, studentForPassword.birthDate)
      : await verifyPassword(password, user.passwordHash);

    if (!ok) {
      return jsonErr("INVALID_CREDENTIALS", "E-mail/CPF ou senha inválidos.", 401);
    }

    const [hasStudent, hasTeacher] = await Promise.all([
      prisma.student.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } }).then((r) => !!r),
      prisma.teacher.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } }).then((r) => !!r),
    ]);
    const hasAdmin = user.isAdmin === true;
    const profileCount = [hasStudent, hasTeacher, hasAdmin].filter(Boolean).length;
    const needsRoleChoice = profileCount >= 2;

    const sessionUser: SessionUser & { isAdmin?: boolean } = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword ?? false,
      isAdmin: user.isAdmin ?? false,
    };

    const token = await buildAuthSessionToken(sessionUser);
    const res = NextResponse.json({
      ok: true as const,
      data: {
        user: {
          id: sessionUser.id,
          name: sessionUser.name,
          email: sessionUser.email,
          role: sessionUser.role,
          mustChangePassword: sessionUser.mustChangePassword,
        },
        needsRoleChoice: needsRoleChoice ?? false,
      },
    });
    res.cookies.set(AUTH_TOKEN_COOKIE_NAME, token, getAuthCookieOptions());
    return res;
  } catch (e) {
    console.error("[auth/login]", e);
    return jsonErr(
      "SERVER_ERROR",
      "Não foi possível concluir o login. Tente novamente.",
      500
    );
  }
}
