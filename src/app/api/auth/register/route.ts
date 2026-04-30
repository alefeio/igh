import { NextResponse } from "next/server";

import { getAuthCookieOptions, AUTH_TOKEN_COOKIE_NAME, buildAuthSessionToken, hashPassword } from "@/lib/auth";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
    }

    const { name, email, password } = parsed.data;
    const exists = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (exists) {
      return jsonErr("EMAIL_IN_USE", "Este e-mail já está cadastrado. Faça login para continuar.", 409);
    }

    const passwordHash = await hashPassword(password);
    const created = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "STUDENT",
        isActive: true,
        mustChangePassword: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        isAdmin: true,
      },
    });

    const token = await buildAuthSessionToken({
      id: created.id,
      name: created.name,
      email: created.email,
      role: created.role,
      isActive: created.isActive,
      mustChangePassword: created.mustChangePassword,
      isAdmin: created.isAdmin ?? false,
    });

    const res = NextResponse.json({
      ok: true as const,
      data: { redirectTo: "/dashboard" },
    });
    res.cookies.set(AUTH_TOKEN_COOKIE_NAME, token, getAuthCookieOptions());
    return res;
  } catch (error) {
    console.error("[auth/register]", error);
    return jsonErr("SERVER_ERROR", "Não foi possível concluir seu cadastro agora. Tente novamente.", 500);
  }
}
