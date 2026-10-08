import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { requireReadableClassGroup, requireTeacherClassGroup } from "@/lib/teacher-class-group-access";
import { normalizeWhatsappGroupUrl } from "@/lib/turma-display";

/** Retorna a turma: o professor só vê as próprias; o Administrador Pedagógico vê qualquer uma. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: classGroupId } = await context.params;
  const access = await requireReadableClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const cg = await prisma.classGroup.findFirst({
    where: { id: classGroupId },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      daysOfWeek: true,
      startTime: true,
      endTime: true,
      capacity: true,
      status: true,
      location: true,
      whatsappGroupUrl: true,
      course: { select: { id: true, name: true } },
      teacher: { select: { name: true } },
      cycle: { select: { cycle: true, year: true } },
      _count: {
        select: {
          enrollments: { where: { status: { in: ["ACTIVE", "SUSPENDED"] } } },
        },
      },
    },
  });
  if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  return jsonOk({
    classGroup: {
      id: cg.id,
      courseId: cg.course.id,
      courseName: cg.course.name,
      cycleNumber: cg.cycle.cycle,
      cycleYear: cg.cycle.year,
      startDate: cg.startDate,
      endDate: cg.endDate,
      daysOfWeek: cg.daysOfWeek,
      startTime: cg.startTime,
      endTime: cg.endTime,
      capacity: cg.capacity,
      status: cg.status,
      location: cg.location,
      whatsappGroupUrl: cg.whatsappGroupUrl,
      teacherName: cg.teacher.name,
      enrollmentsCount: cg._count.enrollments,
    },
  });
}

/** Professor salva o link de convite do grupo de WhatsApp da turma. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: classGroupId } = await context.params;
  const access = await requireTeacherClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const body = (await request.json().catch(() => null)) as { whatsappGroupUrl?: unknown } | null;
  if (!body || typeof body.whatsappGroupUrl !== "string") {
    return jsonErr("VALIDATION_ERROR", "Informe o link do grupo.", 400);
  }
  const parsed = normalizeWhatsappGroupUrl(body.whatsappGroupUrl);
  if (!parsed.ok) return jsonErr("VALIDATION_ERROR", parsed.message, 400);

  const updated = await prisma.classGroup.update({
    where: { id: classGroupId },
    data: { whatsappGroupUrl: parsed.value },
    select: { whatsappGroupUrl: true },
  });
  return jsonOk({ whatsappGroupUrl: updated.whatsappGroupUrl });
}
