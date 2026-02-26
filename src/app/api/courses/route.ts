import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createCourseSchema } from "@/lib/validators/courses";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  await requireRole("MASTER");

  const courses = await prisma.course.findMany({
    orderBy: { name: "asc" },
  });

  return jsonOk({ courses });
}

export async function POST(request: Request) {
  const user = await requireRole("MASTER");

  const body = await request.json().catch(() => null);
  const parsed = createCourseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { name, description, workloadHours, status } = parsed.data;
  const existing = await prisma.course.findUnique({ where: { name }, select: { id: true } });
  if (existing) {
    return jsonErr("DUPLICATE_NAME", "Já existe um curso com este nome.", 409);
  }

  const course = await prisma.course.create({
    data: {
      name,
      description: description || null,
      workloadHours: workloadHours ?? null,
      status: status ?? "ACTIVE",
    },
  });

  await createAuditLog({
    entityType: "Course",
    entityId: course.id,
    action: "CREATE",
    diff: { after: course },
    performedByUserId: user.id,
  });

  return jsonOk({ course }, { status: 201 });
}
