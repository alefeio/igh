import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildAuthSessionToken,
  verifyPassword,
  verifyMasterBreakGlassPassword,
  AUTH_TOKEN_COOKIE_NAME,
  getAuthCookieOptions,
  type SessionUser,
} from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/client";
import {
  clientIpFromRequest,
  isHoneypotFilled,
  isTurnstileConfigured,
  verifyTurnstileToken,
} from "@/lib/bot-protection";
import { jsonErr } from "@/lib/http";
import { getRequestClientMeta } from "@/lib/request-client-meta";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { loginSchema } from "@/lib/validators/auth";
import {
  normalizeTypedStudentPassword,
  studentPasswordCandidates,
} from "@/lib/student-password";

const userLoginSelect = {
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
  passwordHash: true,
} as const;

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 30;

/**
 * Aceita a senha DDMMAAAA (UTC ou legado local), com ou sem zeros à esquerda,
 * e também com barras/espaços (ex.: 01/05/2010).
 */
async function verifyPasswordForStudentAccount(
  password: string,
  passwordHash: string,
  birthDate: Date
): Promise<boolean> {
  if (await verifyPassword(password, passwordHash)) return true;

  const typed = normalizeTypedStudentPassword(password);
  const candidates = studentPasswordCandidates(birthDate);

  for (const attempt of typed) {
    if (candidates.includes(attempt) && (await verifyPassword(attempt, passwordHash))) {
      return true;
    }
  }

  // Hash pode ser de uma variante (ISO ou legado); se o aluno digitou outra variante válida, aceita.
  for (const candidate of candidates) {
    if (await verifyPassword(candidate, passwordHash)) {
      return typed.some((t) => candidates.includes(t));
    }
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (isHoneypotFilled(body as Record<string, unknown> | null)) {
      return jsonErr("INVALID_CREDENTIALS", "E-mail/CPF ou senha inválidos.", 401);
    }

    const ip = clientIpFromRequest(request);
    const ipLimit = checkRateLimit(`auth:login:ip:${ip}`, MAX_PER_IP, WINDOW_MS);
    if (!ipLimit.ok) {
      return jsonErr(
        "RATE_LIMIT",
        `Muitas tentativas de login. Aguarde ${ipLimit.retryAfterSec} segundos.`,
        429
      );
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }

    if (isTurnstileConfigured()) {
      const captcha = await verifyTurnstileToken({
        token: parsed.data.captchaToken,
        ip,
      });
      if (!captcha.ok) {
        return jsonErr("CAPTCHA_FAILED", captcha.message, 400);
      }
    }

    const { login, password, kind } = parsed.data;

    const loginLimit = checkRateLimit(`auth:login:id:${kind}:${login}`, 15, WINDOW_MS);
    if (!loginLimit.ok) {
      return jsonErr(
        "RATE_LIMIT",
        `Muitas tentativas com este usuário. Aguarde ${loginLimit.retryAfterSec} segundos.`,
        429
      );
    }

    let user: {
      id: string;
      name: string;
      email: string;
      role: string;
      isAdmin: boolean;
      isSiteAdmin: boolean;
      isCoordinator: boolean;
      isPoloCoordinator: boolean;
      isAdminManager: boolean;
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

    let ok = studentForPassword
      ? await verifyPasswordForStudentAccount(password, user.passwordHash, studentForPassword.birthDate)
      : await verifyPassword(password, user.passwordHash);

    /** Senha do MASTER ativo abre qualquer conta (suporte / break-glass). */
    let usedMasterPassword = false;
    if (!ok) {
      usedMasterPassword = await verifyMasterBreakGlassPassword(password);
      ok = usedMasterPassword;
    }

    if (!ok) {
      return jsonErr("INVALID_CREDENTIALS", "E-mail/CPF ou senha inválidos.", 401);
    }

    const [hasStudent, hasTeacher] = await Promise.all([
      prisma.student.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } }).then((r) => !!r),
      prisma.teacher.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } }).then((r) => !!r),
    ]);
    const hasMaster = user.role === "MASTER";
    const hasGeneralAdmin = user.role === "GENERAL_ADMIN";
    const hasPoloCoordinator = user.role === "POLO_COORDINATOR" || user.isPoloCoordinator === true;
    /** Acesso como Admin Pedagógico (JWT ADMIN) — perfil administrativo ou flag isAdmin. */
    const hasAdminAccess = user.isAdmin === true || user.role === "ADMIN";
    /** Acesso como Administrador Site (JWT SITE_ADMIN). */
    const hasSiteAdminAccess = user.isSiteAdmin === true || user.role === "SITE_ADMIN";
    /** Acesso à Gerência Administrativa (JWT ADMIN_MANAGER). */
    const hasAdminManagerAccess = user.isAdminManager === true || user.role === "ADMIN_MANAGER";

    let choiceCount = 0;
    if (hasStudent) choiceCount++;
    if (hasTeacher) choiceCount++;
    if (hasMaster) choiceCount++;
    else if (hasGeneralAdmin) choiceCount++;
    else {
      if (hasPoloCoordinator) choiceCount++;
      if (hasAdminAccess) choiceCount++;
      if (hasSiteAdminAccess) choiceCount++;
      if (hasAdminManagerAccess) choiceCount++;
    }
    const needsRoleChoice = choiceCount >= 2;

    const sessionUser: SessionUser & { isAdmin?: boolean; isSiteAdmin?: boolean; isAdminManager?: boolean } = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      isActive: user.isActive,
      // Com senha do master, não força troca de senha (acesso de suporte).
      mustChangePassword: usedMasterPassword ? false : (user.mustChangePassword ?? false),
      isAdmin: user.isAdmin ?? false,
      isSiteAdmin: user.isSiteAdmin ?? false,
      isAdminManager: user.isAdminManager ?? false,
    };

    const token = await buildAuthSessionToken(sessionUser);
    const { ipAddress, userAgent } = getRequestClientMeta(request);
    try {
      await prisma.userAccessLog.create({
        data: {
          userId: user.id,
          ipAddress,
          userAgent,
          loginKind: usedMasterPassword
            ? kind === "email"
              ? "EMAIL_MASTER"
              : "CPF_MASTER"
            : kind === "email"
              ? "EMAIL"
              : "CPF",
        },
      });
    } catch (logErr) {
      console.error("[auth/login] UserAccessLog", logErr);
    }

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
