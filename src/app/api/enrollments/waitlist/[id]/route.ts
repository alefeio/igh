import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Cancela uma reserva da lista de espera. */
export async function DELETE(_request: Request, ctx: Ctx) {
  // Somente Master (papel exato) pode remover reservas da lista de espera.
  const user = await requireRole(["MASTER"], { exactMaster: true });
  const { id } = await ctx.params;

  const entry = await prisma.enrollmentWaitlist.findUnique({
    where: { id },
    select: { id: true, status: true, classGroupId: true, studentId: true },
  });
  if (!entry) {
    return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);
  }

  if (entry.status !== "WAITING") {
    return jsonErr("INVALID_STATE", "Somente reservas em espera podem ser canceladas.", 400);
  }

  await prisma.enrollmentWaitlist.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await createAuditLog({
    entityType: "EnrollmentWaitlist",
    entityId: id,
    action: "UPDATE",
    diff: { status: "CANCELLED", studentId: entry.studentId, classGroupId: entry.classGroupId },
    performedByUserId: user.id,
  });

  return jsonOk({ cancelled: true });
}
