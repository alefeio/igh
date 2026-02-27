import { prisma } from "@/lib/prisma";
import { createSessionCookie, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { setupSchema } from "@/lib/validators/auth";
import { createAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const usersCount = await prisma.user.count();
  if (usersCount > 0) {
    return jsonErr("SETUP_DISABLED", "O setup já foi concluído.", 403);
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "MASTER",
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true },
  });

  await createAuditLog({
    entityType: "User",
    entityId: user.id,
    action: "BOOTSTRAP_MASTER",
    diff: { created: { id: user.id, email: user.email, role: user.role } },
    performedByUserId: null,
  });

  await createSessionCookie(user);
  return jsonOk({ user });
}
