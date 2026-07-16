import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string; enrollmentId: string }> };

/**
 * Alterna se a matrícula está apta a receber certificado.
 * Marca override manual para a regra automática de 70% não sobrescrever.
 */
export async function PATCH(request: Request, context: Ctx) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId, enrollmentId } = await context.params;

  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

  const cg = await prisma.classGroup.findFirst({
    where: { id: classGroupId, ...classGroupTeacherAccessWhere(teacher.id) },
    select: { id: true },
  });
  if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      classGroupId,
      status: { in: ["ACTIVE", "SUSPENDED", "COMPLETED"] },
    },
    select: { id: true, certificateEligible: true, student: { select: { name: true } } },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada nesta turma.", 404);

  const body = await request.json().catch(() => null);
  if (!body || typeof body.certificateEligible !== "boolean") {
    return jsonErr("VALIDATION_ERROR", "Informe certificateEligible (true ou false).", 400);
  }

  const updated = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      certificateEligible: body.certificateEligible,
      certificateEligibleManual: true,
    },
    select: {
      id: true,
      certificateEligible: true,
      certificateEligibleManual: true,
    },
  });

  await createAuditLog({
    entityType: "Enrollment",
    entityId: enrollmentId,
    action: "CERTIFICATE_ELIGIBLE_UPDATED",
    diff: {
      classGroupId,
      studentName: enrollment.student.name,
      before: enrollment.certificateEligible,
      after: updated.certificateEligible,
      manual: true,
    },
    performedByUserId: user.id,
  });

  return jsonOk({
    enrollment: {
      id: updated.id,
      certificateEligible: updated.certificateEligible,
    },
  });
}
