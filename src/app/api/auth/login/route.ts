import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildAuthSessionToken,
  verifyPassword,
  AUTH_TOKEN_COOKIE_NAME,
  getAuthCookieOptions,
} from "@/lib/auth";
import { jsonErr } from "@/lib/http";
import { loginSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isAdmin: true,
        isActive: true,
        mustChangePassword: true,
        passwordHash: true,
      },
    });

    if (!user || !user.isActive) {
      return jsonErr("INVALID_CREDENTIALS", "E-mail ou senha inválidos.", 401);
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return jsonErr("INVALID_CREDENTIALS", "E-mail ou senha inválidos.", 401);
    }

    const [hasStudent, hasTeacher] = await Promise.all([
      prisma.student.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } }).then((r) => !!r),
      prisma.teacher.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } }).then((r) => !!r),
    ]);
    const hasAdmin = user.isAdmin === true;
    const profileCount = [hasStudent, hasTeacher, hasAdmin].filter(Boolean).length;
    const needsRoleChoice = profileCount >= 2;

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword ?? false,
      isAdmin: user.isAdmin ?? false,
    } as const;

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
