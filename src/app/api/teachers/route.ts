import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createTeacherSchema } from "@/lib/validators/teachers";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  await requireRole("MASTER");

  const teachers = await prisma.teacher.findMany({
    where: { deletedAt: null },
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

  const teacher = await prisma.teacher.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      isActive: true,
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
