import { prisma } from "@/lib/prisma";
import { createSessionCookie, verifyPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { loginSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
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

  await createSessionCookie(sessionUser);
  return jsonOk({
    user: {
      id: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      role: sessionUser.role,
      mustChangePassword: sessionUser.mustChangePassword,
    },
    needsRoleChoice: needsRoleChoice ?? false,
  });
}
