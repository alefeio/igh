import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAdminSchema } from "@/lib/validators/users";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  await requireRole("MASTER");

  const users = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return jsonOk({ users });
}

export async function POST(request: Request) {
  const master = await requireRole("MASTER");

  const body = await request.json().catch(() => null);
  const parsed = createAdminSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return jsonErr("EMAIL_IN_USE", "Já existe um usuário com este e-mail.", 409);
  }

  const passwordHash = await hashPassword(password);
  const created = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  await createAuditLog({
    entityType: "User",
    entityId: created.id,
    action: "ADMIN_CREATE",
    diff: { created: { id: created.id, email: created.email, role: created.role } },
    performedByUserId: master.id,
  });

  return jsonOk({ user: created }, { status: 201 });
}
