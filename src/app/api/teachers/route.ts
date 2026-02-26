import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createTeacherSchema } from "@/lib/validators/teachers";
import { createAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  await requireRole("MASTER");

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") ?? "active"; // active | inactive | all

  const where =
    statusFilter === "active"
      ? { deletedAt: null }
      : statusFilter === "inactive"
        ? { deletedAt: { not: null } }
        : {};

  const teachers = await prisma.teacher.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({ teachers });
}

export async function POST(request: Request) {
  const user = await requireRole("MASTER");

  const body = await request.json().catch(() => null);
  const parsed = createTeacherSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existingUser) {
    return jsonErr("EMAIL_IN_USE", "Já existe um usuário com este e-mail.", 409);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const createdUser = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: "TEACHER",
      isActive: true,
    },
  });

  const teacher = await prisma.teacher.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email,
      isActive: true,
      userId: createdUser.id,
    },
  });

  await createAuditLog({
    entityType: "Teacher",
    entityId: teacher.id,
    action: "CREATE",
    diff: { after: teacher },
    performedByUserId: user.id,
  });

  return jsonOk({ teacher }, { status: 201 });
}
