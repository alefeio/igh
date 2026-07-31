import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAuditLog } from "@/lib/audit";
import { poloCoordinatorOwnsClassGroup } from "@/lib/polo-coordinator-scope";

type Ctx = { params: Promise<{ id: string }> };

/** Cancela uma reserva da lista de espera. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR", "POLO_COORDINATOR"]);
  const { id } = await ctx.params;

  const entry = await prisma.enrollmentWaitlist.findUnique({
    where: { id },
    select: { id: true, status: true, classGroupId: true, studentId: true },
  });
  if (!entry) {
    return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);
  }

  if (user.role === "POLO_COORDINATOR") {
    const ok = await poloCoordinatorOwnsClassGroup(user.id, entry.classGroupId);
    if (!ok) {
      return jsonErr("FORBIDDEN", "Reserva fora do escopo dos polos que você coordena.", 403);
    }
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
