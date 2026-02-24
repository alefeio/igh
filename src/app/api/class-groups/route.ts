import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createClassGroupSchema } from "@/lib/validators/class-groups";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  await requireRole("MASTER");

  const classGroups = await prisma.classGroup.findMany({
    orderBy: { createdAt: "desc" },
    include: { course: true, teacher: true },
  });

  return jsonOk({ classGroups });
}

export async function POST(request: Request) {
  const user = await requireRole("MASTER");

  const body = await request.json().catch(() => null);
  const parsed = createClassGroupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { courseId, teacherId } = parsed.data;

  const [course, teacher] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }),
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true, deletedAt: true } }),
  ]);

  if (!course) return jsonErr("INVALID_COURSE", "Curso inválido.", 400);
  if (!teacher || teacher.deletedAt) return jsonErr("INVALID_TEACHER", "Professor inválido.", 400);

  const classGroup = await prisma.classGroup.create({
    data: {
      courseId: parsed.data.courseId,
      teacherId: parsed.data.teacherId,
      daysOfWeek: parsed.data.daysOfWeek,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      capacity: parsed.data.capacity,
      status: parsed.data.status ?? "PLANEJADA",
      location: parsed.data.location || null,
    },
  });

  await createAuditLog({
    entityType: "ClassGroup",
    entityId: classGroup.id,
    action: "CREATE",
    diff: { after: classGroup },
    performedByUserId: user.id,
  });

  return jsonOk({ classGroup }, { status: 201 });
}
